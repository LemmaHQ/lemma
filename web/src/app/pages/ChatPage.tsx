import { timestampDate } from "@bufbuild/protobuf/wkt";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { AppSidebar } from "@/app/shell/AppSidebar";
import { SidebarRevealToggle } from "@/app/shell/SidebarToggle";
import { ChatComposer } from "@/features/agent/components/ChatComposer";
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
import { useConversations } from "@/features/conversations/useConversations";
import { useProviders } from "@/features/providers/useProviders";
import type { SessionSummary } from "@/features/conversations/grouping";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useChat as useChatStore } from "@/features/agent/store";
import { setTitleBarSurface } from "@/features/preferences/theme";

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

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

export function ChatPage() {
    const { t } = useTranslation();
    const conversations = useConversations();
    const chat = useChatStore();
    const providersStore = useProviders();
    const navigate = useNavigate();

    const activeId = useParams().id ?? null;
    const [sidebarOpen, setSidebarOpenState] = useState(
        () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) !== "1",
    );
    const [draft, setDraft] = useState("");
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    const inputRef = useRef<HTMLTextAreaElement>(null);

    const setSidebarOpen = (open: boolean) => {
        setSidebarOpenState(open);
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, open ? "0" : "1");
    };

    const { model, options: modelOptions, selectModel } = useModelSelection();

    const openConversation = useChatStore((s) => s.open);
    useEffect(() => {
        if (activeId !== null) {
            void openConversation(activeId);
        }
    }, [activeId, openConversation]);

    useEffect(() => {
        setTitleBarSurface("sidebar");
    }, []);

    const sendText = async (text: string) => {
        if (chat.streaming) {
            return;
        }
        if (model === null) {
            void navigate("/settings/providers");
            return;
        }
        try {
            let cid = activeId;
            if (cid === null) {
                cid = await conversations.create();
                void navigate(`/conversations/${cid}`);
                await chat.open(cid);
            }
            await chat.send(model.providerId, model.model, text);
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
        void chat.abort();
    };

    const handleRegenerate = (messageId: string) => {
        if (chat.streaming || model === null) {
            return;
        }
        const idx = chat.items.findIndex((m) => m.id === messageId);
        if (idx < 0) {
            return;
        }
        for (let i = idx - 1; i >= 0; i--) {
            const prev = chat.items[i];
            if (prev !== undefined && prev.role === "user") {
                void chat.send(model.providerId, model.model, prev.content);
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
    return (
        <SidebarProvider
            open={sidebarOpen}
            onOpenChange={setSidebarOpen}
            className="h-dvh"
        >
            <AppSidebar
                sessions={summaries}
                activeSessionId={activeId}
                onGoHome={() => {
                    void navigate("/");
                }}
                onOpenSession={(id) => {
                    void navigate(`/conversations/${id}`);
                }}
                onRenameSession={(id, title) =>
                    void runAction(() => conversations.rename(id, title))
                }
                onDeleteSession={setPendingDeleteId}
            />

            <SidebarInset className="overflow-hidden">
                {activeId === null ? (
                    <>
                        <div className="absolute top-3 left-3 z-10">
                            <SidebarRevealToggle />
                        </div>
                        <HomeView
                            onSubmit={(text) => void sendText(text)}
                            model={model}
                            modelOptions={modelOptions}
                            onModelChange={selectModel}
                        />
                    </>
                ) : (
                    <>
                        <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3">
                            <SidebarRevealToggle />
                            <span className="truncate text-sm font-medium text-foreground">
                                {activeSession !== undefined &&
                                activeSession.title !== ""
                                    ? activeSession.title
                                    : t("sidebar.newChat")}
                            </span>
                        </header>
                        <MessageList
                            items={chat.items}
                            conversationId={chat.conversationId}
                            providerNameById={providerNameById}
                            onPickSuggestion={handlePickSuggestion}
                            onRegenerate={handleRegenerate}
                        />
                        <div className="mx-auto w-full max-w-3xl px-6 pb-6">
                            <ChatComposer
                                value={draft}
                                onChange={setDraft}
                                onSend={handleSend}
                                onStop={handleStop}
                                streaming={chat.streaming}
                                model={model}
                                modelOptions={modelOptions}
                                onModelChange={selectModel}
                                inputRef={inputRef}
                            />
                        </div>
                    </>
                )}
            </SidebarInset>

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
        </SidebarProvider>
    );
}
