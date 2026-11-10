import type { AgentEvent } from "@/gen/lemma/v1/agent_pb";
import { ErrorReason } from "@/gen/lemma/v1/errors_pb";
import { errorReason } from "@/rpc/errors";

import type { AgentItem } from "./agent-item";

const MAX_RESUME = 3;

/** Identity and cancellation state for one send. */
export interface Turn {
    controller: AbortController;
    messageId: string | null;
    userAborted: boolean;
}

interface TurnPorts {
    openStream: (
        received: number,
    ) => AsyncIterable<{ event?: AgentEvent | undefined }>;
    applyEvent: (event?: AgentEvent) => void;
    updateCurrent: (patch: Partial<AgentItem>) => void;
    reload: () => Promise<void>;
    failedText: (cause: unknown) => string;
}

/** Runs one send stream to completion, resuming broken streams in place. */
export async function runTurn(turn: Turn, ports: TurnPorts): Promise<void> {
    let received = 0;

    const attempt = async (resumes: number): Promise<void> => {
        try {
            for await (const res of ports.openStream(received)) {
                received += 1;
                ports.applyEvent(res.event);
            }
        } catch (e) {
            if (turn.userAborted || turn.controller.signal.aborted) {
                ports.updateCurrent({ status: "aborted" });
                return;
            }
            if (errorReason(e) === ErrorReason.TURN_NOT_RUNNING) {
                await ports.reload();
                return;
            }
            const next = resumes + 1;
            if (turn.messageId === null || next > MAX_RESUME) {
                ports.updateCurrent({
                    status: "error",
                    error: ports.failedText(e),
                });
                return;
            }
            await new Promise<void>((resolve) => {
                setTimeout(resolve, 500 * next);
            });
            await attempt(next);
        }
    };

    await attempt(0);
}
