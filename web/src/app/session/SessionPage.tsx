import { useNavigate, useOutletContext, useParams } from "react-router";

import { SessionView } from "@/features/agent";
import { useModelOptions } from "@/features/provider";
import { createSession, type SessionDirectoryState } from "@/features/session";

import { paths, rememberSessionPath, sessionPath } from "../route-paths";

/** The active session or new-session page, wiring directory state, models, and session creation into `SessionView`. */
export function SessionPage() {
    const navigate = useNavigate();
    const activeId = useParams().id ?? null;
    const directoryState = useOutletContext<SessionDirectoryState>();
    const { options, providers } = useModelOptions();

    return (
        <SessionView
            sessionId={activeId}
            directoryControl={{
                directory: directoryState.directory,
                recentDirectories: directoryState.recentDirectories,
                canPickDirectory: directoryState.canPickDirectory,
                onSelectDirectory: directoryState.selectDirectory,
                onPickDirectory: directoryState.pickDirectory,
            }}
            modelOptions={options}
            providers={providers}
            onOpenProviders={() => {
                rememberSessionPath(sessionPath(activeId));
                void navigate(paths.settingsPage("providers"));
            }}
            onCreateSession={async (newDirectory) => {
                const id = await createSession(newDirectory);
                void navigate(paths.session(id));
                return id;
            }}
        />
    );
}
