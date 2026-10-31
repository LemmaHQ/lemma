import { ToolCallCard, ToolCallGroup, type ToolCallStatus } from "@lemma/ui";
import { useTranslation } from "react-i18next";

import type { ToolCallItem } from "../agent-item";

interface ToolCallListProps {
    calls: ToolCallItem[];
}

export function ToolCallList({ calls }: ToolCallListProps) {
    const { t } = useTranslation();
    const running = calls.some((call) => call.state === "running");
    const failed = calls.filter((call) => statusOf(call) === "error").length;
    const labels = {
        failed: t("agent.toolCall.failed"),
        arguments: t("agent.toolCall.arguments"),
        copyArguments: t("agent.toolCall.copyArguments"),
        output: t("agent.toolCall.output"),
        copyResult: t("agent.toolCall.copyResult"),
        waiting: t("agent.toolCall.waiting"),
        copied: t("common.copied"),
        showAll: t("agent.toolCall.showAll"),
        showLess: t("agent.toolCall.showLess"),
    };

    return (
        <ToolCallGroup
            title={t(
                running ? "agent.toolGroup.running" : "agent.toolGroup.used",
                { count: calls.length },
            )}
            failedLabel={t("agent.toolGroup.failed", { count: failed })}
        >
            {calls.map((call) => {
                const status = statusOf(call);
                const error = call.isError
                    ? call.output === ""
                        ? t("agent.toolCall.errorFallback")
                        : call.output
                    : undefined;
                return (
                    <ToolCallCard
                        key={call.id}
                        name={call.name}
                        status={status}
                        labels={labels}
                        announcement={
                            status === "error"
                                ? t("agent.toolCall.announce.error", {
                                      name: call.name,
                                      error,
                                  })
                                : t(`agent.toolCall.announce.${status}`, {
                                      name: call.name,
                                  })
                        }
                        args={call.arguments}
                        result={
                            call.state === "done" && !call.isError
                                ? call.output
                                : undefined
                        }
                        error={error}
                        startedAt={call.startedAt}
                        finishedAt={call.finishedAt}
                    />
                );
            })}
        </ToolCallGroup>
    );
}

function statusOf(call: ToolCallItem): ToolCallStatus {
    if (call.state === "running") {
        return "running";
    }
    return call.isError ? "error" : "success";
}
