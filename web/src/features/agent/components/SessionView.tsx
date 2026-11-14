import { ComposerBox, toast } from "@lemma/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import { useActiveSession } from "../store";
import {
    type ModelOption,
    type ModelSelection,
    useModelSelection,
} from "../useModelSelection";
import { ActiveSessionView } from "./ActiveSessionView";
import { FolderPicker } from "./FolderPicker";
import { ModelPickerPopover } from "./ModelPickerPopover";

/** Provider and its enabled model ids displayed in the model picker. */
export interface SessionProviderGroup {
    id: string;
    name: string;
    enabled: boolean;
    models: { id: string }[];
}

/** Workspace directory selection state and callbacks for the composer footer. */
export interface SessionDirectoryControl {
    directory: string | undefined;
    recentDirectories: string[];
    canPickDirectory: boolean;
    onSelectDirectory?: (dir: string | undefined) => void;
    onPickDirectory?: () => Promise<string | undefined>;
}

/** Props for rendering either the blank new-session stage or an active branched session. */
export interface SessionViewProps {
    sessionId: string | null;
    directoryControl: SessionDirectoryControl;
    modelOptions: ModelOption[];
    providers: SessionProviderGroup[];
    onOpenProviders: () => void;
    onCreateSession: (directory?: string) => Promise<string>;
}

/** New-session composer view or active conversation stage with step inspection and branch tree. */
export function SessionView({
    sessionId,
    directoryControl,
    modelOptions,
    providers,
    onOpenProviders,
    onCreateSession,
}: SessionViewProps) {
    const { t } = useTranslation();
    const session = useActiveSession();
    const { model, selectModel } = useModelSelection(modelOptions);
    const [draft, setDraft] = useState("");
    const [modelPickerOpen, setModelPickerOpen] = useState(false);

    const openSession = useActiveSession((s) => s.open);
    useEffect(() => {
        if (sessionId !== null) {
            void openSession(sessionId);
        }
    }, [sessionId, openSession]);

    const submitFor = (selected: ModelSelection) => () => {
        const text = draft.trim();
        setDraft("");
        void (async () => {
            try {
                let cid = sessionId;
                if (cid === null) {
                    cid = await onCreateSession(directoryControl.directory);
                    await session.open(cid);
                }
                await session.send(selected.providerId, selected.model, text);
            } catch (error) {
                toast.error(errorText(error, t));
            }
        })();
    };
    const handleSubmit = model === null ? undefined : submitFor(model);
    const sharedFooter = (
        <>
            <FolderPicker
                editable={sessionId === null}
                directoryControl={directoryControl}
            />
            <ModelPickerPopover
                open={modelPickerOpen}
                onOpenChange={setModelPickerOpen}
                model={model}
                providers={providers}
                onSelectModel={selectModel}
                onOpenProviders={onOpenProviders}
            />
        </>
    );

    if (sessionId === null) {
        return (
            <div className="flex min-h-0 flex-1 flex-col bg-background">
                <div className="flex-1" />
                <div className="shrink-0 px-4 pb-4 md:px-6">
                    <div className="mx-auto w-full max-w-170">
                        <ComposerBox
                            value={draft}
                            onChange={setDraft}
                            {...(handleSubmit === undefined
                                ? {}
                                : { onSubmit: handleSubmit })}
                            placeholder={
                                model === null
                                    ? t("session.noModelPlaceholder")
                                    : t("session.inputPlaceholder")
                            }
                            sendLabel={t("session.send")}
                            disabled={model === null}
                            canSend={!session.streaming && draft.trim() !== ""}
                            footerStart={sharedFooter}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <ActiveSessionView
            sessionId={sessionId}
            draft={draft}
            onDraftChange={setDraft}
            {...(handleSubmit === undefined ? {} : { onSubmit: handleSubmit })}
            model={model}
            sharedFooter={sharedFooter}
            onOpenModelPicker={() => setModelPickerOpen(true)}
        />
    );
}
