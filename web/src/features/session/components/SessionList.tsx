import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    Button,
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input,
    toast,
} from "@lemma/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import type { SessionSummary } from "../grouping";
import { useSessionStore } from "../store";
import { SessionGroups } from "./SessionGroups";

export interface SessionListProps {
    activeSessionId?: string | undefined;
    activeNewDirectory?: string | undefined;
    isNewSessionView?: boolean | undefined;
    onSelectSession: (id: string) => void;
    onNewInDirectory?: ((directory: string | undefined) => void) | undefined;
    onSessionDeleted?: ((id: string) => void) | undefined;
}
function selectInput(el: HTMLInputElement | null) {
    el?.focus();
    el?.select();
}

function RenameSessionDialog({
    session,
    onClose,
    onConfirm,
}: {
    session: SessionSummary;
    onClose: () => void;
    onConfirm: (id: string, title: string) => void;
}) {
    const { t } = useTranslation();
    const [title, setTitle] = useState(session.title);
    const trimmed = title.trim();

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent closeLabel={t("common.close")}>
                <form
                    className="flex flex-col gap-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (trimmed !== session.title) {
                            onConfirm(session.id, trimmed);
                        }
                        onClose();
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>{t("session.rename")}</DialogTitle>
                    </DialogHeader>
                    <Input
                        ref={selectInput}
                        aria-label={t("session.rename")}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                    <DialogFooter>
                        <DialogClose
                            render={<Button type="button" variant="outline" />}
                        >
                            {t("common.cancel")}
                        </DialogClose>
                        <Button type="submit" disabled={trimmed === ""}>
                            {t("common.save")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** Store-backed directory-grouped session list with rename dialog and confirmed deletion. */
export function SessionList({
    activeSessionId,
    activeNewDirectory,
    isNewSessionView = false,
    onSelectSession,
    onNewInDirectory,
    onSessionDeleted,
}: SessionListProps) {
    const { t } = useTranslation();
    const [pendingRename, setPendingRename] = useState<SessionSummary | null>(
        null,
    );
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
                activeSessionId={activeSessionId}
                activeNewDirectory={activeNewDirectory}
                isNewSessionView={isNewSessionView}
                onOpenSession={onSelectSession}
                onNewInDirectory={onNewInDirectory}
                onRequestRename={setPendingRename}
                onDeleteSession={setPendingDeleteId}
            />
            {pendingRename !== null && (
                <RenameSessionDialog
                    key={pendingRename.id}
                    session={pendingRename}
                    onClose={() => setPendingRename(null)}
                    onConfirm={(id, title) =>
                        void runAction(() =>
                            useSessionStore.getState().rename(id, title),
                        )
                    }
                />
            )}
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
                                    const deletingId = pendingDeleteId;
                                    setPendingDeleteId(null);
                                    void runAction(async () => {
                                        await useSessionStore
                                            .getState()
                                            .delete(deletingId);
                                        onSessionDeleted?.(deletingId);
                                    });
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
