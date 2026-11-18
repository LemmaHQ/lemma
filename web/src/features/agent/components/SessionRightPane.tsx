import {
    DetailPane,
    type DetailPaneBody,
    type DetailPaneProps,
    Markdown,
    SessionTreePane,
    type SessionTreePaneLabels,
    type TreePaneRow,
} from "@lemma/ui";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import { stepVerb, type TurnStep } from "../step-details";

export type ActiveRightPane =
    | { mode: "step"; step: TurnStep }
    | { mode: "code"; code: string; language: string }
    | { mode: "tree"; rows: TreePaneRow[]; pathCount: number };
interface SessionRightPaneProps {
    pane: ActiveRightPane;
    onSelectTreeRow: (id: string) => void;
    onSaveLabel: (id: string, label: string) => void;
    onClose: () => void;
}

function stepDetailBody(step: TurnStep, t: TFunction): DetailPaneBody {
    switch (step.detail.kind) {
        case "prose":
            return {
                kind: "prose",
                content: <Markdown>{step.detail.text}</Markdown>,
            };
        case "code":
            return {
                kind: "code",
                code: step.detail.code,
                language: step.detail.language,
                copyLabel: t("common.copyCode"),
                copiedLabel: t("common.copied"),
            };
        case "web":
            return {
                kind: "web",
                note: step.detail.note,
                hits: step.detail.hits.map((hit, index) => ({
                    id: `${step.id}-${index}`,
                    title: hit.title,
                    url: hit.url,
                    snippet: hit.snippet === "" ? undefined : hit.snippet,
                })),
            };
        case "output":
            return {
                kind: "output",
                content: step.detail.text,
                warn: step.isError ? true : undefined,
            };
    }
}

function stepTitle(step: TurnStep, t: TFunction): string {
    if (step.kind === "thinking") {
        return t("agent.thinking");
    }
    return step.argument === "" ? (step.toolName ?? "") : step.argument;
}

function stepDetailProps(
    step: TurnStep,
    t: TFunction,
): Pick<DetailPaneProps, "verb" | "title" | "meta" | "body"> {
    const verb = stepVerb(step, t);
    const meta = step.selfHealed
        ? t("agent.selfHealed")
        : step.isError
          ? t("agent.toolCall.failed")
          : step.via;
    return {
        verb,
        title: stepTitle(step, t),
        meta,
        body: stepDetailBody(step, t),
    };
}

/** Right-side inspector drawer for timeline steps, code blocks, and the session branch tree. */
export function SessionRightPane({
    pane,
    onSelectTreeRow,
    onSaveLabel,
    onClose,
}: SessionRightPaneProps) {
    const { t } = useTranslation();

    if (pane.mode === "step") {
        return (
            <DetailPane
                {...stepDetailProps(pane.step, t)}
                closeLabel={t("common.close")}
                onClose={onClose}
            />
        );
    }

    if (pane.mode === "code") {
        return (
            <DetailPane
                verb={t("agent.verbCode")}
                title={
                    pane.language === ""
                        ? t("session.codeTitle")
                        : pane.language
                }
                closeLabel={t("common.close")}
                onClose={onClose}
                body={{
                    kind: "code",
                    code: pane.code,
                    language: pane.language === "" ? undefined : pane.language,
                    copyLabel: t("common.copyCode"),
                    copiedLabel: t("common.copied"),
                }}
            />
        );
    }

    const treeLabels: SessionTreePaneLabels = {
        verb: t("session.treeVerb"),
        title: t("session.treeTitle"),
        hint: t("session.treeHint"),
        pathsLabel: t("session.treePaths", { count: pane.pathCount }),
        closeLabel: t("common.close"),
        searchPlaceholder: t("session.treeSearchPlaceholder"),
        emptyText: t("session.treeEmpty"),
        filterAll: t("session.treeFilterAll"),
        filterQuestions: t("session.treeFilterQuestions"),
        filterLabeled: t("session.treeFilterLabeled"),
        addLabel: t("session.treeAddLabel"),
        editLabel: t("session.treeEditLabel"),
        labelPlaceholder: t("session.treeLabelPlaceholder"),
    };

    return (
        <SessionTreePane
            rows={pane.rows}
            labels={treeLabels}
            onSelectRow={onSelectTreeRow}
            onSaveLabel={onSaveLabel}
            onClose={onClose}
        />
    );
}
