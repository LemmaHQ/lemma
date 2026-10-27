import { timestampDate } from "@bufbuild/protobuf/wkt";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { ShellSidebar } from "@/app/shell/ShellSidebar";
import { useShellTitle } from "@/app/shell/useShellTitle";
import { MessageComposer } from "@/features/agent/components/MessageComposer";
import { HomeView } from "@/features/agent/components/HomeView";
import { MessageList } from "@/features/agent/components/MessageList";
import { useModelSelection } from "@/features/agent/useModelSelection";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { errorText } from "@/data/rpc/errors";
import type { Conversation } from "@/gen/lemma/v1/conversation_pb";
import { ConversationList } from "@/features/conversations/ConversationList";
import { useConversations } from "@/features/conversations/useConversations";
import { useProviders } from "@/features/providers/useProviders";
import type { SessionSummary } from "@/features/conversations/grouping";
import { useActiveConversation } from "@/features/agent/store";

function toSummary(c: Conversation): SessionSummary {
    return {
        id: c.id,
        title: c.title,
        updatedAtMs:
            c.updatedAt === undefined
                ? 0
                : timestampDate(c.updatedAt).getTime(),
    };
}

export function ConversationPage() {
    const { t } = useTranslation();
    const conversations = useConversations();
    const conversation = useActiveConversation();
    const providersStore = useProviders();
    const navigate = useNavigate();

    const activeId = useParams().id ?? null;
    const [draft, setDraft] = useState("");
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    const inputRef = useRef<HTMLTextAreaElement>(null);

    const { model, options: modelOptions, selectModel } = useModelSelection();

    const openConversation = useActiveConversation((s) => s.open);
    useEffect(() => {
        if (activeId !== null) {
            void openConversation(activeId);
        }
    }, [activeId, openConversation]);

    const sendText = async (text: string) => {
        if (conversation.streaming) {
            return;
        }
        if (model === null) {
            void navigate("/settings/providers", { viewTransition: true });
            return;
        }
        try {
            let cid = activeId;
            if (cid === null) {
                cid = await conversations.create();
                void navigate(`/conversations/${cid}`);
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

    const runAction = async (action: () => Promise<void>) => {
        try {
            await action();
        } catch (e) {
            toast.error(errorText(e, t));
        }
    };

    const handlePickSuggestion = (text: string) => {
        setDraft(text);
        inputRef.current?.focus();
    };

    const summaries = useMemo(
        () => conversations.list.map(toSummary),
        [conversations.list],
    );

    const providerNameById = useMemo(() => {
        const map = new Map<string, string>();
        for (const p of providersStore.list) {
            map.set(p.id, p.name);
        }
        return map;
    }, [providersStore.list]);

    const activeSession = summaries.find((s) => s.id === activeId);
    useShellTitle(
        activeId === null
            ? undefined
            : activeSession !== undefined && activeSession.title !== ""
              ? activeSession.title
              : t("sidebar.newConversation"),
    );

    return (
        <>
            <ShellSidebar>
                <ConversationList
                    sessions={summaries}
                    activeSessionId={activeId}
                    onOpenSession={(id) => {
                        void navigate(`/conversations/${id}`);
                    }}
                    onRenameSession={(id, title) =>
                        void runAction(() => conversations.rename(id, title))
                    }
                    onDeleteSession={setPendingDeleteId}
                />
            </ShellSidebar>
            {activeId === null ? (
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
            )}

            <AlertDialog
                open={pendingDeleteId !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingDeleteId(null);
                    }
                }}
            >
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t("sessions.deleteTitle")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("sessions.deleteDescription")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            {t("common.cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={() => {
                                if (pendingDeleteId !== null) {
                                    void runAction(() =>
                                        conversations.delete(pendingDeleteId),
                                    );
                                }
                            }}
                        >
                            {t("sessions.delete")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
