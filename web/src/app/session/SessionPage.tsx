import { useNavigate, useOutletContext, useParams } from "react-router";

import {
    ActiveSessionView,
    beginCreatedSession,
    NewSessionStage,
} from "@/features/agent";
import { useModelOptions } from "@/features/provider";
import { createSession, type SessionDirectoryState } from "@/features/session";

import { paths, rememberSessionPath, sessionPath } from "../route-paths";

/** Routes between `NewSessionStage` on home and `ActiveSessionView` on `/sessions/:id`. */
export function SessionPage() {
    const navigate = useNavigate();
    const activeId = useParams().id ?? null;
    const directoryState = useOutletContext<SessionDirectoryState>();
    const { options, providers } = useModelOptions();

    const openProviders = () => {
        rememberSessionPath(sessionPath(activeId));
        void navigate(paths.settingsPage("providers"));
    };

    if (activeId === null) {
        return (
            <NewSessionStage
                directoryControl={{
                    directory: directoryState.directory,
                    recentDirectories: directoryState.recentDirectories,
                    canPickDirectory: directoryState.canPickDirectory,
                    onSelectDirectory: directoryState.selectDirectory,
                    onPickDirectory: directoryState.pickDirectory,
                }}
                modelOptions={options}
                providers={providers}
                onOpenProviders={openProviders}
                onCreateSession={async (newDirectory) => {
                    const id = await createSession(newDirectory);
                    beginCreatedSession(id);
                    void navigate(paths.session(id));
                    return id;
                }}
            />
        );
    }

    return (
        <ActiveSessionView
            sessionId={activeId}
            directory={directoryState.directory}
            modelOptions={options}
            providers={providers}
            onOpenProviders={openProviders}
        />
    );
}
