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
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import { useConversations } from "../useConversations";
import { SessionList } from "./SessionList";

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
                sessions={conversations.list}
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
