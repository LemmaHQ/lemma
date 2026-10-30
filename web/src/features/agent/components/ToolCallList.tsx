import {
    ToolCallCard,
    ToolCallGroup,
} from "@lemma/ui/components/ai-elements/tool";

import type { ToolCallItem } from "@/features/agent/agent-item";

interface ToolCallListProps {
    calls: ToolCallItem[];
}

export function ToolCallList({ calls }: ToolCallListProps) {
    return (
        <ToolCallGroup>
            {calls.map((call) => (
                <ToolCallCard
                    key={call.id}
                    name={call.name}
                    status={
                        call.state === "running"
                            ? "running"
                            : call.isError
                              ? "error"
                              : "success"
                    }
                    args={call.arguments}
                    result={
                        call.state === "done" && !call.isError
                            ? call.output
                            : undefined
                    }
                    error={call.isError ? call.output : undefined}
                    startedAt={call.startedAt}
                    finishedAt={call.finishedAt}
                />
            ))}
        </ToolCallGroup>
    );
}
