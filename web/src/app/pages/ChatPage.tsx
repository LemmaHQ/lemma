import { timestampDate } from "@bufbuild/protobuf/wkt";
import { PanelLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";

import { AppSidebar } from "@/app/shell/AppSidebar";
import { ChatComposer } from "@/features/agent/components/ChatComposer";
import { HomeView } from "@/features/agent/components/HomeView";
import { MessageList } from "@/features/agent/components/MessageList";
import { useModelSelection } from "@/features/agent/useModelSelection";
import { Button } from "@/components/ui/button";
import type { Conversation } from "@/gen/lemma/v1/conversation_pb";
import { useConversations } from "@/features/conversations/useConversations";
import { useProviders } from "@/features/providers/useProviders";
import type { SessionSummary } from "@/features/conversations/grouping";
import { cn } from "@/lib/utils";
import { useChat as useChatStore } from "@/features/agent/store";
import { setTitleBarSurface } from "@/features/preferences/theme";

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

function toSummary(c: Conversation): SessionSummary {
    return {
        id: c.id,
        title: c.title,
        updatedAtMs: c.updatedAt ? timestampDate(c.updatedAt).getTime() : 0,
    };
}

export function ChatPage() {
    const { t } = useTranslation();
    const conversations = useConversations();
    const chat = useChatStore();
    const providersStore = useProviders();
    const navigate = useNavigate();

    const activeId = useParams().id ?? null;
    const [sidebarCollapsed, setSidebarCollapsed] = useState(
        () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1",
    );
    const [draft, setDraft] = useState("");

    const inputRef = useRef<HTMLTextAreaElement>(null);

    const toggleSidebar = (collapsed: boolean) => {
        setSidebarCollapsed(collapsed);
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    };

    const { model, options: modelOptions, selectModel } = useModelSelection();

    const openConversation = useChatStore((s) => s.open);
    useEffect(() => {
        if (activeId) {
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
        if (!model) {
            navigate("/settings/providers");
            return;
        }
        try {
            let cid = activeId;
            if (!cid) {
                cid = await conversations.create();
                navigate(`/conversations/${cid}`);
                await chat.open(cid);
            }
            await chat.send(model.providerId, model.model, text);
        } catch {
            return;
        }
    };

    const handleSend = () => {
        const text = draft.trim();
        if (!text) {
            return;
        }
        setDraft("");
        void sendText(text);
    };

    const handleStop = () => {
        void chat.abort();
    };

    const handleRegenerate = (messageId: string) => {
        if (chat.streaming || !model) {
            return;
        }
        const idx = chat.items.findIndex((m) => m.id === messageId);
        if (idx < 0) {
            return;
        }
        for (let i = idx - 1; i >= 0; i--) {
            const prev = chat.items[i];
            if (prev.role === "user") {
                void chat.send(model.providerId, model.model, prev.content);
                return;
            }
        }
    };

    const handleArchive = async (id: string) => {
        await conversations.archive(id);
        if (id === activeId) {
            navigate("/");
        }
    };

    const handleRename = async (id: string, title: string) => {
        await conversations.rename(id, title);
    };

    const handleRestore = async (id: string) => {
        await conversations.restore(id);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm(t("sessions.deleteConfirm"))) {
            await conversations.deleteArchived(id);
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
    const archivedSummaries = useMemo(
        () => conversations.archived.map(toSummary),
        [conversations.archived],
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
        <div className="flex h-dvh bg-sidebar text-foreground">
            <div
                aria-hidden={sidebarCollapsed}
                className={cn(
                    "shrink-0 overflow-hidden transition-all duration-200 ease-out",
                    sidebarCollapsed ? "w-0 opacity-0" : "w-65 opacity-100",
                )}
            >
                <AppSidebar
                    sessions={summaries}
                    archived={archivedSummaries}
                    activeSessionId={activeId}
                    onGoHome={() => navigate("/")}
                    onOpenSession={(id) => navigate(`/conversations/${id}`)}
                    onArchiveSession={(id) => void handleArchive(id)}
                    onRenameSession={(id, title) =>
                        void handleRename(id, title)
                    }
                    onRestoreSession={(id) => void handleRestore(id)}
                    onDeleteSession={(id) => void handleDelete(id)}
                    onCollapse={() => toggleSidebar(true)}
                />
            </div>

            <main
                className={cn(
                    "min-w-0 flex-1 transition-[padding] duration-200 ease-out",
                    sidebarCollapsed ? "p-2" : "py-2 pr-2",
                )}
            >
                <div className="relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-background">
                    {activeId !== null && (
                        <div className="glass absolute inset-x-0 top-0 z-20 flex h-12 items-center justify-start border-b border-border/80 px-3">
                            <div className="flex min-w-0 items-center gap-2">
                                {sidebarCollapsed && (
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className="size-8 text-muted-foreground"
                                        onClick={() => toggleSidebar(false)}
                                        aria-label={t("sidebar.expand")}
                                        title={t("sidebar.expand")}
                                    >
                                        <PanelLeft className="size-4" />
                                    </Button>
                                )}
                                <span className="truncate text-sm font-medium text-foreground">
                                    {activeSession?.title ||
                                        t("sidebar.newChat")}
                                </span>
                            </div>
                        </div>
                    )}
                    {activeId === null && sidebarCollapsed && (
                        <div className="absolute top-3 left-3 z-10">
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                className="glass size-8 rounded-lg border border-border text-muted-foreground"
                                onClick={() => toggleSidebar(false)}
                                aria-label={t("sidebar.expand")}
                                title={t("sidebar.expand")}
                            >
                                <PanelLeft className="size-4" />
                            </Button>
                        </div>
                    )}
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
                                items={chat.items}
                                resetKey={activeId}
                                providerNameById={providerNameById}
                                onPickSuggestion={handlePickSuggestion}
                                onRegenerate={handleRegenerate}
                            />
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
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
