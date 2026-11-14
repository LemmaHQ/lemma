import {
    cn,
    formatDuration,
    MessageActions,
    MessageCopyAction,
    MessageRegenerateAction,
    MessageResponse,
    StepTimeline,
    type StepTimelineRow,
    TurnCard,
} from "@lemma/ui";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { ConversationTurn } from "../active-path";
import type { AgentItem } from "../agent-item";
import { formatClockTime, stepVerb, type TurnStep } from "../step-details";
import { lastPathSegment } from "../tool-output";

interface TurnViewProps {
    turn: ConversationTurn;
    activePaneStepId: string | undefined;
    streaming?: boolean | undefined;
    onInspectStep: (step: TurnStep) => void;
    onInspectCode: (code: string, language: string) => void;
    onRegenerate?:
        ((turn: ConversationTurn, reply: AgentItem) => void) | undefined;
}

function summarizeToolStep(step: TurnStep, t: TFunction): string {
    switch (step.toolName) {
        case "read_file":
            return t("agent.summaryRead", {
                target:
                    step.argument === ""
                        ? "read_file"
                        : lastPathSegment(step.argument),
            });
        case "write_file":
            return t("agent.summaryWrote", {
                target:
                    step.argument === ""
                        ? "write_file"
                        : lastPathSegment(step.argument),
            });
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

/** Single conversation turn with sticky user card, collapsible step timeline, final reply, and settled actions. */
export function TurnView({
    turn,
    activePaneStepId,
    streaming = false,
    onInspectStep,
    onInspectCode,
    onRegenerate,
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
    const settledReply = reply?.status === "done" ? reply : undefined;
    const footerMeta =
        settledReply === undefined
            ? undefined
            : turnFooterMeta(turn, settledReply);
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
            meta,
            via: step.via,
        };
    });

    return (
        <TurnCard
            turnId={turn.id}
            question={turn.userMessage.content}
            timeLabel={timeLabel}
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
            {settledReply !== undefined && (
                <MessageActions className="mt-2">
                    {settledReply.content !== "" && (
                        <MessageCopyAction
                            text={settledReply.content}
                            label={t("common.copy")}
                            copiedLabel={t("common.copied")}
                        />
                    )}
                    {onRegenerate !== undefined && (
                        <MessageRegenerateAction
                            label={t("session.regenerate")}
                            disabled={streaming}
                            onRegenerate={() =>
                                onRegenerate(turn, settledReply)
                            }
                        />
                    )}
                    {footerMeta !== undefined && (
                        <span className="ml-1 tabular-nums">{footerMeta}</span>
                    )}
                </MessageActions>
            )}
            {showAborted && (
                <p className="mt-1.5 text-small text-subtle-foreground">
                    {t("agent.abortedNotice")}
                </p>
            )}
        </TurnCard>
    );
}

function turnFooterMeta(
    turn: ConversationTurn,
    reply: AgentItem,
): string | undefined {
    const startMs = turn.userMessage.createdAtMs;
    const endMs = reply.thinkingFinishedAt ?? reply.createdAtMs;
    const durationText =
        startMs !== undefined && endMs !== undefined && endMs > startMs
            ? formatDuration(endMs - startMs)
            : undefined;
    const parts = [
        reply.model === "" ? undefined : reply.model,
        durationText,
    ].filter((part): part is string => part !== undefined);
    return parts.length > 0 ? parts.join(" · ") : undefined;
}
