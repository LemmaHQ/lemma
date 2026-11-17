import { ComposerBox } from "@lemma/ui";
import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useActiveSessionStore } from "../store";
import type { ModelSelection } from "../useModelSelection";
import { ModelPickerPopover } from "./ModelPickerPopover";

/** Provider and its enabled model ids displayed in the model picker. */
export interface SessionProviderGroup {
    id: string;
    name: string;
    enabled: boolean;
    models: { id: string }[];
}

interface SessionComposerProps {
    sessionKey: string;
    onSubmit?: ((trimmedText: string) => void) | undefined;
    streaming: boolean;
    focusTrigger?: number | undefined;
    model: ModelSelection | null;
    providers: SessionProviderGroup[];
    modelPickerOpen: boolean;
    onModelPickerOpenChange: (open: boolean) => void;
    onSelectModel: (selection: ModelSelection) => void;
    onOpenProviders: () => void;
    directorySlot: ReactNode;
    trailingFooter?: ReactNode;
    dock?: ReactNode;
    running?: ComponentProps<typeof ComposerBox>["running"];
}

/** Shared composer box owning per-session draft subscription so typing never re-renders the turn stage. */
export function SessionComposer({
    sessionKey,
    onSubmit,
    streaming,
    focusTrigger,
    model,
    providers,
    modelPickerOpen,
    onModelPickerOpenChange,
    onSelectModel,
    onOpenProviders,
    directorySlot,
    trailingFooter,
    dock,
    running,
}: SessionComposerProps) {
    const { t } = useTranslation();
    const draft = useActiveSessionStore(
        (state) => state.drafts[sessionKey] ?? "",
    );
    const setDraft = useActiveSessionStore((state) => state.setDraft);
    const trimmed = draft.trim();

    return (
        <ComposerBox
            value={draft}
            onChange={(value) => setDraft(sessionKey, value)}
            onSubmit={
                onSubmit === undefined ? undefined : () => onSubmit(trimmed)
            }
            placeholder={
                model === null
                    ? t("session.noModelPlaceholder")
                    : t("session.inputPlaceholder")
            }
            sendLabel={t("session.send")}
            disabled={model === null}
            canSend={!streaming && trimmed !== ""}
            focusTrigger={focusTrigger}
            dock={dock}
            running={running}
            footerStart={
                <>
                    {directorySlot}
                    <ModelPickerPopover
                        open={modelPickerOpen}
                        onOpenChange={onModelPickerOpenChange}
                        model={model}
                        providers={providers}
                        onSelectModel={onSelectModel}
                        onOpenProviders={onOpenProviders}
                    />
                    {trailingFooter}
                </>
            }
        />
    );
}
