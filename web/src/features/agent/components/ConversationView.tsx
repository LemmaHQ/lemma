import { toast } from "@lemma/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useConversations } from "@/features/conversations";
import { useProviders } from "@/features/providers";
import { errorText } from "@/i18n/error-text";

import { useActiveConversation } from "../store";
import { useModelSelection } from "../useModelSelection";
import { HomeView } from "./HomeView";
import { MessageComposer } from "./MessageComposer";
import { MessageList } from "./MessageList";

/** Active conversation or new-conversation composer, with navigation owned by the page. */
export function ConversationView({
    conversationId,
    onConversationCreated,
    onModelMissing,
}: {
    conversationId: string | null;
    onConversationCreated: (id: string) => void;
    onModelMissing: () => void;
}) {
    const { t } = useTranslation();
    const conversations = useConversations();
    const conversation = useActiveConversation();
    const providersStore = useProviders();
    const [draft, setDraft] = useState("");
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const { model, options: modelOptions, selectModel } = useModelSelection();

    const openConversation = useActiveConversation((s) => s.open);
    useEffect(() => {
        if (conversationId !== null) {
            void openConversation(conversationId);
        }
    }, [conversationId, openConversation]);

    const sendText = async (text: string) => {
        if (conversation.streaming) {
            return;
        }
        if (model === null) {
            onModelMissing();
            return;
        }
        try {
            let cid = conversationId;
            if (cid === null) {
                cid = await conversations.create();
                onConversationCreated(cid);
                await conversation.open(cid);
            }
            await conversation.send(model.providerId, model.model, text);
        } catch (e) {
            toast.error(errorText(e, t));
        }
    };

    const handleSend = () => {
        const text = draft.trim();
        if (text === "") {
            return;
        }
        setDraft("");
        void sendText(text);
    };

    const handleStop = () => {
        void conversation.abort();
    };

    const handleRegenerate = (messageId: string) => {
        if (conversation.streaming || model === null) {
            return;
        }
        const idx = conversation.items.findIndex((m) => m.id === messageId);
        if (idx < 0) {
            return;
        }
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

    const providerNameById = useMemo(() => {
        const map = new Map<string, string>();
        for (const p of providersStore.list) {
            map.set(p.id, p.name);
        }
        return map;
    }, [providersStore.list]);

    return conversationId === null ? (
        <HomeView
            onSubmit={(text) => void sendText(text)}
            model={model}
            modelOptions={modelOptions}
            onModelChange={selectModel}
        />
    ) : (
        <>
            <MessageList
                items={conversation.items}
                conversationId={conversation.conversationId}
                providerNameById={providerNameById}
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
                    inputRef={inputRef}
                />
            </div>
        </>
    );
}
