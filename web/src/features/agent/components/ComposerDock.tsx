import { Button } from "@lemma/ui";
import { useTranslation } from "react-i18next";

export type ComposerDockState =
    | { kind: "rewind"; onRestore: () => void }
    | {
          kind: "error";
          error: string | undefined;
          retryModel: string;
          onRetry: () => void;
          onSwitchModel: () => void;
      };

interface ComposerDockProps {
    state: ComposerDockState;
}

/** Rewind notice or error recovery bar docked above the composer textarea. */
export function ComposerDock({ state }: ComposerDockProps) {
    const { t } = useTranslation();

    if (state.kind === "rewind") {
        return (
            <div className="flex items-center justify-between gap-2 text-small">
                <span className="min-w-0 truncate text-muted-foreground">
                    {t("session.rewindBanner")}
                </span>
                <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={state.onRestore}
                >
                    {t("session.rewindRestore")}
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-wrap items-center justify-between gap-2 text-small">
            <span className="min-w-0 flex-1 truncate text-destructive">
                {state.error !== undefined && state.error !== ""
                    ? state.error
                    : t("errors.agentFailed")}
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
                <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={state.onSwitchModel}
                >
                    {t("session.switchModelRetry")}
                </Button>
                <Button type="button" size="xs" onClick={state.onRetry}>
                    {t("session.retryWithModel", { model: state.retryModel })}
                </Button>
            </div>
        </div>
    );
}
