import { toast } from "@lemma/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import { useActiveSessionStore } from "../store";
import { type ModelOption, useModelSelection } from "../useModelSelection";
import { SessionComposer, type SessionProviderGroup } from "./SessionComposer";
import {
    type SessionDirectoryControl,
    SessionFolderPicker,
} from "./SessionFolderPicker";

export interface NewSessionStageProps {
    directoryControl: SessionDirectoryControl;
    modelOptions: ModelOption[];
    providers: SessionProviderGroup[];
    onOpenProviders: () => void;
    onCreateSession: (directory?: string) => Promise<string>;
}

/** Blank home stage for composing the first message of a new session. */
export function NewSessionStage({
    directoryControl,
    modelOptions,
    providers,
    onOpenProviders,
    onCreateSession,
}: NewSessionStageProps) {
    const { t } = useTranslation();
    const [creating, setCreating] = useState(false);
    const { model, selectModel } = useModelSelection(modelOptions);
    const [modelPickerOpen, setModelPickerOpen] = useState(false);

    const handleSubmit =
        model === null
            ? undefined
            : (text: string) => {
                  setCreating(true);
                  void (async () => {
                      try {
                          const createdId = await onCreateSession(
                              directoryControl.directory,
                          );
                          const state = useActiveSessionStore.getState();
                          state.beginCreatedSession(createdId);
                          await state.send(model.providerId, model.model, text);
                      } catch (error) {
                          toast.error(errorText(error, t));
                      } finally {
                          setCreating(false);
                      }
                  })();
              };

    return (
        <div className="flex min-h-0 flex-1 flex-col bg-background">
            <div className="flex-1" />
            <div className="shrink-0 px-4 pb-4 md:px-6">
                <div className="mx-auto w-full max-w-170">
                    <SessionComposer
                        sessionKey=""
                        onSubmit={handleSubmit}
                        streaming={creating}
                        model={model}
                        providers={providers}
                        modelPickerOpen={modelPickerOpen}
                        onModelPickerOpenChange={setModelPickerOpen}
                        onSelectModel={selectModel}
                        onOpenProviders={onOpenProviders}
                        folderSlot={
                            <SessionFolderPicker
                                directoryControl={directoryControl}
                            />
                        }
                    />
                </div>
            </div>
        </div>
    );
}
