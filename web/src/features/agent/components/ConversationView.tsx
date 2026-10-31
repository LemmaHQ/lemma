import { toast } from "@lemma/ui";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import { useActiveConversation } from "../store";
import { useModelSelection, type ModelOption } from "../useModelSelection";
import { HomeView } from "./HomeView";
import { MessageComposer } from "./MessageComposer";
import { MessageList } from "./MessageList";

/** Active conversation or new-conversation composer; the page supplies the models, creates conversations, and names the path of the provider settings. */
export function ConversationView({
    conversationId,
    modelOptions,
    providerNames,
    providersPath,
    onCreateConversation,
}: {
    conversationId: string | null;
    modelOptions: ModelOption[];
    providerNames: Map<string, string>;
    providersPath: string;
    onCreateConversation: () => Promise<string>;
}) {
    const { t } = useTranslation();
    const conversation = useActiveConversation();
    const [draft, setDraft] = useState("");
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const { model, selectModel } = useModelSelection(modelOptions);

    const openConversation = useActiveConversation((s) => s.open);
    useEffect(() => {
        if (conversationId !== null) {
            void openConversation(conversationId);
        }
    }, [conversationId, openConversation]);

    const sendText = async (text: string) => {
        if (conversation.streaming || model === null) {
            return;
        }
        try {
            let cid = conversationId;
            if (cid === null) {
                cid = await onCreateConversation();
                await conversation.open(cid);
            }
            await conversation.send(model.providerId, model.model, text);
        } catch (e) {
            toast.error(errorText(e, t));
        }
    };

    const handleSend = () => {
        setDraft("");
        void sendText(draft.trim());
    };

    const handleStop = () => {
        void conversation.abort();
    };

    const handleRegenerate = (messageId: string) => {
        if (conversation.streaming || model === null) {
            return;
        }
        const idx = conversation.items.findIndex((m) => m.id === messageId);
        for (let i = idx - 1; i >= 0; i--) {
            const prev = conversation.items[i];
            if (prev !== undefined && prev.role === "user") {
                void conversation.send(
                    model.providerId,
                    model.model,
                    prev.content,
                );
                return;
            }
        }
    };

    const handlePickSuggestion = (text: string) => {
        setDraft(text);
        inputRef.current?.focus();
    };

    return conversationId === null ? (
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
                items={conversation.items}
                conversationId={conversation.conversationId}
                hasMore={conversation.hasMore}
                providerNameById={providerNames}
                onLoadMore={conversation.loadMore}
                onPickSuggestion={handlePickSuggestion}
                onRegenerate={handleRegenerate}
            />
            <div className="mx-auto w-full max-w-3xl px-6 pb-6">
                <MessageComposer
                    value={draft}
                    onChange={setDraft}
                    onSend={handleSend}
                    onStop={handleStop}
                    streaming={conversation.streaming}
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
