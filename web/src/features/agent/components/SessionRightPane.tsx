import {
    DetailPane,
    type DetailPaneBody,
    type DetailPaneProps,
    MessageResponse,
    SessionTreePane,
    type SessionTreePaneLabels,
    type TreePaneRow,
} from "@lemma/ui";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import { formatClockTime, toolVerb, type TurnStep } from "../step-details";
import type { FlatTreeRow } from "../tree";

export type ActiveRightPane =
    | { mode: "step"; step: TurnStep }
    | { mode: "code"; code: string; language: string }
    | { mode: "tree"; rows: FlatTreeRow[]; pathCount: number };

interface SessionRightPaneProps {
    pane: ActiveRightPane;
    onSelectTreeRow: (id: string) => void;
    onSaveLabel: (id: string, label: string) => void;
    onClose: () => void;
}

function mapTreeRows(rows: FlatTreeRow[]): TreePaneRow[] {
    return rows.map((row) => {
        const meta =
            row.role === "assistant"
                ? (row.model ??
                  (row.createdAtMs === undefined
                      ? undefined
                      : formatClockTime(row.createdAtMs)))
                : row.createdAtMs === undefined
                  ? undefined
                  : formatClockTime(row.createdAtMs);
        return {
            id: row.id,
            kind: row.role === "user" ? "question" : "answer",
            title: row.text === "" ? (row.model ?? "") : row.text,
            rails: row.rails.map((cell) => cell.type),
            hasTopSpine: row.hasParentSpine,
            hasBottomSpine: row.hasChildSpine,
            onPath: row.onPath,
            isLeaf: row.isLeaf,
            ...(row.label === undefined ? {} : { label: row.label }),
            ...(meta === undefined ? {} : { meta }),
        };
    });
}

function stepDetailBody(step: TurnStep): DetailPaneBody {
    switch (step.detail.kind) {
        case "prose":
            return {
                kind: "prose",
                content: <MessageResponse>{step.detail.text}</MessageResponse>,
            };
        case "code":
            return {
                kind: "code",
                code: step.detail.code,
                ...(step.detail.language === undefined
                    ? {}
                    : { language: step.detail.language }),
            };
        case "web":
            return {
                kind: "web",
                hits: step.detail.hits.map((hit, index) => ({
                    id: `${step.id}-${index}`,
                    title: hit.title,
                    url: hit.url,
                    ...(hit.snippet === "" ? {} : { snippet: hit.snippet }),
                })),
            };
        case "output":
            return {
                kind: "output",
                content: step.detail.text,
                ...(step.isError ? { warn: true } : {}),
            };
    }
}

function stepDetailProps(
    step: TurnStep,
    t: TFunction,
): Pick<DetailPaneProps, "verb" | "title" | "meta" | "body"> {
    const verb =
        step.kind === "thinking"
            ? t("agent.thinking")
            : toolVerb(step.toolName);
    const title =
        step.kind === "thinking"
            ? t("agent.thinking")
            : step.argument === ""
              ? (step.toolName ?? "")
              : step.argument;
    const meta = step.selfHealed
        ? t("agent.selfHealed")
        : step.isError
          ? t("agent.toolCall.failed")
          : step.via;
    return {
        verb,
        title,
        body: stepDetailBody(step),
        ...(meta === undefined ? {} : { meta }),
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
                verb="code"
                title={
                    pane.language === ""
                        ? t("session.openInPane")
                        : pane.language
                }
                closeLabel={t("common.close")}
                onClose={onClose}
                body={{
                    kind: "code",
                    code: pane.code,
                    ...(pane.language === ""
                        ? {}
                        : { language: pane.language }),
                }}
            />
        );
    }

    const treeLabels: SessionTreePaneLabels = {
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
            rows={mapTreeRows(pane.rows)}
            labels={treeLabels}
            onSelectRow={onSelectTreeRow}
            onSaveLabel={onSaveLabel}
            onClose={onClose}
        />
    );
}
