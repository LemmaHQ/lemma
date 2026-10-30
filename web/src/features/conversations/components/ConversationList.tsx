import { timestampDate } from "@bufbuild/protobuf/wkt";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    toast,
} from "@lemma/ui";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Conversation } from "@/gen/lemma/v1/conversation_pb";
import { errorText } from "@/i18n/error-text";

import type { SessionSummary } from "../grouping";
import { useConversations } from "../useConversations";
import { SessionList } from "./SessionList";

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

/** Store-backed conversation list with rename and confirmed deletion. */
export function ConversationList({
    activeId,
    onOpen,
}: {
    activeId: string | null;
    onOpen: (id: string) => void;
}) {
    const { t } = useTranslation();
    const conversations = useConversations();
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const summaries = useMemo(
        () => conversations.list.map(toSummary),
        [conversations.list],
    );

    const runAction = async (action: () => Promise<void>) => {
        try {
            await action();
        } catch (e) {
            toast.error(errorText(e, t));
        }
    };

    return (
        <>
            <SessionList
                sessions={summaries}
                loaded={conversations.loaded}
                activeSessionId={activeId}
                onOpenSession={onOpen}
                onRenameSession={(id, title) =>
                    void runAction(() => conversations.rename(id, title))
                }
                onDeleteSession={setPendingDeleteId}
            />
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
