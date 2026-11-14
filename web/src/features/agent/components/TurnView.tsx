import {
    cn,
    formatDuration,
    MessageResponse,
    StepTimeline,
    type StepTimelineRow,
    TurnCard,
} from "@lemma/ui";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { formatClockTime, toolVerb, type TurnStep } from "../step-details";
import type { ConversationTurn } from "../tree";

interface TurnViewProps {
    turn: ConversationTurn;
    activePaneStepId: string | undefined;
    onInspectStep: (step: TurnStep) => void;
    onInspectCode: (code: string, language: string) => void;
}

function stepVerb(step: TurnStep, t: TFunction): string {
    return step.kind === "thinking"
        ? t("agent.thinking")
        : toolVerb(step.toolName);
}

function summarizeToolStep(step: TurnStep, t: TFunction): string {
    switch (step.toolName) {
        case "read_file": {
            const base =
                step.argument.split(/[\\/]/u).findLast(Boolean) ??
                step.argument;
            return t("agent.summaryRead", {
                target: step.argument === "" ? "read_file" : base,
            });
        }
        case "write_file": {
            const base =
                step.argument.split(/[\\/]/u).findLast(Boolean) ??
                step.argument;
            return t("agent.summaryWrote", {
                target: step.argument === "" ? "write_file" : base,
            });
        }
        case "bash":
            return t("agent.summaryRan", {
                target: step.argument === "" ? "bash" : step.argument,
            });
        case "web_search":
            return t("agent.summarySearchedWeb");
        case "web_fetch":
            return t("agent.summaryFetchedWeb");
        default:
            return step.toolName ?? "";
    }
}

function buildStepsSummary(steps: TurnStep[], t: TFunction): string {
    const parts: string[] = [];
    let thinkingMs = 0;
    let hasThinkingDuration = false;
    let hasThinking = false;
    let thinkingRunning = false;

    for (const step of steps) {
        if (step.kind === "thinking") {
            hasThinking = true;
            if (step.state === "running") {
                thinkingRunning = true;
            }
            if (step.startedAt !== undefined && step.finishedAt !== undefined) {
                hasThinkingDuration = true;
                thinkingMs += Math.max(0, step.finishedAt - step.startedAt);
            }
            continue;
        }
        const label = summarizeToolStep(step, t);
        if (label !== "" && !parts.includes(label)) {
            parts.push(label);
        }
    }

    if (hasThinking) {
        const thinkingLabel = thinkingRunning
            ? t("agent.thinkingInProgress")
            : hasThinkingDuration
              ? t("agent.thoughtDuration", {
                    duration: formatDuration(thinkingMs),
                })
              : t("agent.thinking");
        parts.unshift(thinkingLabel);
    }

    return parts.length > 0
        ? parts.join(" · ")
        : t("agent.stepCount", { count: steps.length });
}

/** Single conversation turn with sticky user card, collapsible step timeline, and final reply. */
export function TurnView({
    turn,
    activePaneStepId,
    onInspectStep,
    onInspectCode,
}: TurnViewProps) {
    const { t } = useTranslation();
    const [stepsOpen, setStepsOpen] = useState(false);

    const timeLabel =
        turn.userMessage.createdAtMs === undefined
            ? undefined
            : formatClockTime(turn.userMessage.createdAtMs);

    const reply = turn.finalReply;
    const showReply = reply !== undefined && reply.content !== "";
    const showAborted = reply?.status === "aborted";

    const rows: StepTimelineRow[] = turn.steps.map((step) => {
        const meta = step.selfHealed
            ? t("agent.selfHealed")
            : step.isError
              ? t("agent.toolCall.failed")
              : undefined;
        return {
            id: step.id,
            verb: stepVerb(step, t),
            argument:
                step.argument === ""
                    ? step.kind === "thinking"
                        ? t("agent.thinkingInProgress")
                        : (step.toolName ?? "")
                    : step.argument,
            plainArgument: step.plainArgument,
            warn: step.warn,
            active: activePaneStepId === step.id,
            onSelect: () => onInspectStep(step),
            ...(meta === undefined ? {} : { meta }),
            ...(step.via === undefined ? {} : { via: step.via }),
        };
    });

    return (
        <TurnCard
            turnId={turn.id}
            question={turn.userMessage.content}
            {...(timeLabel === undefined ? {} : { timeLabel })}
        >
            {turn.steps.length > 0 && (
                <div className={cn((showReply || showAborted) && "mb-3")}>
                    <StepTimeline
                        summary={buildStepsSummary(turn.steps, t)}
                        outcome={t("agent.stepCount", {
                            count: turn.steps.length,
                        })}
                        open={stepsOpen}
                        onOpenChange={setStepsOpen}
                        rows={rows}
                    />
                </div>
            )}
            {showReply && (
                <MessageResponse
                    isAnimating={reply.status === "streaming"}
                    openCodeLabel={t("session.openInPane")}
                    onOpenCode={onInspectCode}
                    completionMark={reply.status === "done"}
                >
                    {reply.content}
                </MessageResponse>
            )}
            {showAborted && (
                <p className="mt-1.5 text-small text-subtle-foreground">
                    {t("agent.abortedNotice")}
                </p>
            )}
        </TurnCard>
    );
}
