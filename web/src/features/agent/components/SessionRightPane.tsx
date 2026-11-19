import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import type { SessionTreeRow } from "../session-tree";
import { stepVerb, type TurnStep } from "../step-details";
import { SessionTreePane } from "./SessionTreePane";
import { StepDetailPane } from "./StepDetailPane";

export type ActiveRightPane =
    | { mode: "step"; step: TurnStep }
    | { mode: "code"; code: string; language: string }
    | { mode: "tree"; rows: SessionTreeRow[]; pathCount: number };
interface SessionRightPaneProps {
    pane: ActiveRightPane;
    onSelectTreeRow: (id: string) => void;
    onSaveLabel: (id: string, label: string) => void;
    onClose: () => void;
}

function stepTitle(step: TurnStep, t: TFunction): string {
    if (step.kind === "thinking") {
        return t("agent.thinking");
    }
    return step.argument === "" ? (step.toolName ?? "") : step.argument;
}

function stepMeta(step: TurnStep, t: TFunction): string | undefined {
    if (step.selfHealed) {
        return t("agent.selfHealed");
    }
    return step.isError ? t("agent.toolCall.failed") : step.via;
}

/** Right-side inspector drawer for timeline steps, code blocks, and the session branch tree. */
export function SessionRightPane({
    pane,
    onSelectTreeRow,
    onSaveLabel,
    onClose,
}: SessionRightPaneProps) {
    const { t } = useTranslation();

    switch (pane.mode) {
        case "step":
            return (
                <StepDetailPane
                    verb={stepVerb(pane.step, t)}
                    title={stepTitle(pane.step, t)}
                    meta={stepMeta(pane.step, t)}
                    detail={pane.step.detail}
                    warn={pane.step.isError}
                    onClose={onClose}
                />
            );
        case "code":
            return (
                <StepDetailPane
                    verb={t("agent.verbCode")}
                    title={
                        pane.language === ""
                            ? t("session.codeTitle")
                            : pane.language
                    }
                    meta={undefined}
                    detail={{
                        kind: "code",
                        code: pane.code,
                        language: pane.language,
                    }}
                    warn={false}
                    onClose={onClose}
                />
            );
        case "tree":
            return (
                <SessionTreePane
                    rows={pane.rows}
                    pathCount={pane.pathCount}
                    onSelectRow={onSelectTreeRow}
                    onSaveLabel={onSaveLabel}
                    onClose={onClose}
                />
            );
    }
}
