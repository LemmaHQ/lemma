import { toast } from "@lemma/ui";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import { useActiveSession } from "../store";
import { useModelSelection, type ModelOption } from "../useModelSelection";
import { HomeView } from "./HomeView";
import { MessageComposer } from "./MessageComposer";
import { MessageList } from "./MessageList";

/** Active session or new-session composer; the page supplies the models, creates sessions, and names the path of the provider settings. */
export function SessionView({
    sessionId,
    modelOptions,
    providerNames,
    providersPath,
    onCreateSession,
}: {
    sessionId: string | null;
    modelOptions: ModelOption[];
    providerNames: Map<string, string>;
    providersPath: string;
    onCreateSession: () => Promise<string>;
}) {
    const { t } = useTranslation();
    const session = useActiveSession();
    const [draft, setDraft] = useState("");
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const { model, selectModel } = useModelSelection(modelOptions);

    const openSession = useActiveSession((s) => s.open);
    useEffect(() => {
        if (sessionId !== null) {
            void openSession(sessionId);
        }
    }, [sessionId, openSession]);

    const sendText = async (text: string) => {
        if (session.streaming || model === null) {
            return;
        }
        try {
            let cid = sessionId;
            if (cid === null) {
                cid = await onCreateSession();
                await session.open(cid);
            }
            await session.send(model.providerId, model.model, text);
        } catch (e) {
            toast.error(errorText(e, t));
        }
    };

    const handleSend = () => {
        setDraft("");
        void sendText(draft.trim());
    };

    const handleStop = () => {
        void session.abort();
    };

    const handleRegenerate = (messageId: string) => {
        if (session.streaming || model === null) {
            return;
        }
        const idx = session.items.findIndex((m) => m.id === messageId);
        for (let i = idx - 1; i >= 0; i--) {
            const prev = session.items[i];
            if (prev !== undefined && prev.role === "user") {
                void session.send(model.providerId, model.model, prev.content);
                return;
            }
        }
    };

    const handlePickSuggestion = (text: string) => {
        setDraft(text);
        inputRef.current?.focus();
    };

    return sessionId === null ? (
        <HomeView
            onSubmit={(text) => void sendText(text)}
            model={model}
            modelOptions={modelOptions}
            onModelChange={selectModel}
            providersPath={providersPath}
        />
    ) : (
        <>
            <MessageList
                items={session.items}
                sessionId={session.sessionId}
                hasMore={session.hasMore}
                providerNameById={providerNames}
                onLoadMore={session.loadMore}
                onPickSuggestion={handlePickSuggestion}
                onRegenerate={handleRegenerate}
            />
            <div className="mx-auto w-full max-w-3xl px-6 pb-6">
                <MessageComposer
                    value={draft}
                    onChange={setDraft}
                    onSend={handleSend}
                    onStop={handleStop}
                    streaming={session.streaming}
                    model={model}
                    modelOptions={modelOptions}
                    onModelChange={selectModel}
                    providersPath={providersPath}
                    inputRef={inputRef}
                />
            </div>
        </>
    );
}
