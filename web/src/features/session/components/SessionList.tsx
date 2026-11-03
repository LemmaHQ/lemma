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

import { useSessions } from "../useSessions";
import { SessionGroups } from "./SessionGroups";

/** Store-backed session list with rename and confirmed deletion. */
export function SessionList({
    activeId,
    onOpen,
}: {
    activeId: string | null;
    onOpen: (id: string) => void;
}) {
    const { t } = useTranslation();
    const sessions = useSessions();
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
            <SessionGroups
                sessions={sessions.list}
                loaded={sessions.loaded}
                activeSessionId={activeId}
                onOpenSession={onOpen}
                onRenameSession={(id, title) =>
                    void runAction(() => sessions.rename(id, title))
                }
                onDeleteSession={setPendingDeleteId}
            />
            <AlertDialog
                open={pendingDeleteId !== null}
                onOpenChange={() => {
                    setPendingDeleteId(null);
                }}
            >
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t("session.deleteTitle")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("session.deleteDescription")}
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
                                    setPendingDeleteId(null);
                                    void runAction(() =>
                                        sessions.delete(pendingDeleteId),
                                    );
                                }
                            }}
                        >
                            {t("session.delete")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
