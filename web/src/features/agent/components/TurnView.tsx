import { cn, formatClockTime, formatDuration, Markdown } from "@lemma/ui";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { ConversationTurn } from "../active-path";
import { stepVerb, type TurnStep } from "../step-details";
import { lastPathSegment } from "../tool-output";
import type { UiMessage } from "../ui-message";
import { StepTimeline, type StepTimelineRow } from "./StepTimeline";
import { TurnReplyActions } from "./TurnReplyActions";

interface TurnViewProps {
    turn: ConversationTurn;
    activePaneStepId: string | undefined;
    streaming?: boolean | undefined;
    onInspectStep: (step: TurnStep) => void;
    onInspectCode: (code: string, language: string) => void;
    onRegenerate?:
        ((turn: ConversationTurn, reply: UiMessage) => void) | undefined;
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
        <div data-turn-id={turn.id} className="group/turn flex flex-col">
            <div
                data-say-card=""
                className="sticky top-2.5 z-10 -mx-4 mb-3.5 flex items-baseline gap-4 rounded-lg bg-selected px-4 py-2.5 text-reading font-normal text-foreground"
            >
                <div className="min-w-0 flex-1 wrap-break-word">
                    {turn.userMessage.content}
                </div>
                {timeLabel !== undefined && (
                    <time className="shrink-0 text-caption text-subtle-foreground tabular-nums opacity-0 transition-opacity duration-base group-focus-within/turn:opacity-100 group-hover/turn:opacity-100">
                        {timeLabel}
                    </time>
                )}
            </div>
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
                <Markdown
                    streaming={reply.status === "streaming"}
                    endMark={
                        reply.status === "done" ? (
                            <span aria-hidden="true" className="qed-mark" />
                        ) : undefined
                    }
                    renderCodeActions={(block) => (
                        <button
                            type="button"
                            onClick={() =>
                                onInspectCode(block.code, block.language)
                            }
                            className="cursor-pointer rounded-sm px-1.5 py-0.5 text-caption font-medium text-muted-foreground transition-colors duration-base hover:text-foreground"
                        >
                            {t("session.openInPane")}
                        </button>
                    )}
                >
                    {reply.content}
                </Markdown>
            )}
            {settledReply !== undefined && (
                <div className="mt-2">
                    <TurnReplyActions
                        text={settledReply.content}
                        meta={footerMeta}
                        regenerateDisabled={streaming}
                        onRegenerate={
                            onRegenerate === undefined
                                ? undefined
                                : () => onRegenerate(turn, settledReply)
                        }
                    />
                </div>
            )}
            {showAborted && (
                <p className="mt-1.5 text-small text-subtle-foreground">
                    {t("agent.abortedNotice")}
                </p>
            )}
        </div>
    );
}

function turnFooterMeta(
    turn: ConversationTurn,
    reply: UiMessage,
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
