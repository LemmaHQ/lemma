import type { TFunction } from "i18next";

import type { AgentItem } from "./agent-item";
import {
    type DetailPayload,
    nonEmptyString,
    parseJsonObject,
    parseToolOutput,
} from "./tool-output";

export type { DetailPayload };

/** Timeline step derived from an assistant item's thinking or tool call. */
export interface TurnStep {
    id: string;
    kind: "thinking" | "tool";
    toolName?: string | undefined;
    argument: string;
    plainArgument: boolean;
    startedAt?: number | undefined;
    finishedAt?: number | undefined;
    via?: string | undefined;
    isError: boolean;
    selfHealed: boolean;
    warn: boolean;
    state: "running" | "done";
    detail: DetailPayload;
}

const ARG_KEY: Partial<Record<string, "path" | "command" | "query" | "url">> = {
    read_file: "path",
    write_file: "path",
    bash: "command",
    web_search: "query",
    web_fetch: "url",
};

/** Extracts a concise display argument from a tool call's raw JSON arguments. */
export function formatToolArgument(name: string, rawArgs: string): string {
    const key = ARG_KEY[name];
    if (key === undefined) {
        return rawArgs;
    }
    const parsed = parseJsonObject(rawArgs);
    return parsed === null ? rawArgs : (nonEmptyString(parsed[key]) ?? rawArgs);
}

/** Builds structured timeline steps and detail payloads across all assistant items of a turn. */
export function buildTurnSteps(assistantSteps: AgentItem[]): TurnStep[] {
    const toolFlat = assistantSteps.flatMap((step) => step.toolCalls);
    const finalStatus = assistantSteps.at(-1)?.status;
    const steps: TurnStep[] = [];
    let flatCursor = 0;

    for (const [stepIndex, item] of assistantSteps.entries()) {
        if (item.thinking !== "" || item.thinkingStartedAt !== undefined) {
            steps.push(thinkingStep(item));
        }
        for (const call of item.toolCalls) {
            const hasLaterSuccess =
                (stepIndex < assistantSteps.length - 1 &&
                    finalStatus === "done") ||
                toolFlat
                    .slice(flatCursor + 1)
                    .some((later) => later.state === "done" && !later.isError);
            const argument = formatToolArgument(call.name, call.arguments);
            const parsed = parseToolOutput(call, argument);
            steps.push({
                id: call.id,
                kind: "tool",
                toolName: call.name,
                argument,
                plainArgument: call.name === "web_search",
                startedAt: call.startedAt,
                finishedAt: call.finishedAt,
                via: parsed.via,
                isError: call.isError,
                selfHealed: call.isError && hasLaterSuccess,
                warn: call.isError,
                state: call.state,
                detail: parsed.detail,
            });
            flatCursor += 1;
        }
    }
    return steps;
}

function thinkingStep(item: AgentItem): TurnStep {
    const argument =
        item.thinking
            .split("\n")
            .find((line) => line.trim() !== "")
            ?.trim() ?? "";
    const state =
        item.status === "streaming" && item.thinkingFinishedAt === undefined
            ? "running"
            : "done";
    return {
        id: `${item.id}:thinking`,
        kind: "thinking",
        argument,
        plainArgument: true,
        startedAt: item.thinkingStartedAt,
        finishedAt: item.thinkingFinishedAt,
        isError: false,
        selfHealed: false,
        warn: false,
        state,
        detail: { kind: "prose", text: item.thinking },
    };
}

/** Localized short verb badge for a timeline step or detail-pane header. */
export function stepVerb(step: TurnStep, t: TFunction): string {
    if (step.kind === "thinking") {
        return t("agent.thinking");
    }
    switch (step.toolName) {
        case "read_file":
            return t("agent.verbRead");
        case "write_file":
            return t("agent.verbWrite");
        case "bash":
            return t("agent.verbBash");
        case "web_search":
            return t("agent.verbSearch");
        case "web_fetch":
            return t("agent.verbFetch");
        default:
            return step.toolName ?? "";
    }
}
