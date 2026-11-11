import { useNavigate, useParams } from "react-router";

import { SessionView } from "@/features/agent";
import { createSession, useSessionDirectory } from "@/features/session";
import { useModelOptions } from "@/features/provider";

import { paths } from "../route-paths";

export function SessionPage() {
    const navigate = useNavigate();
    const activeId = useParams().id ?? null;
    const directory = useSessionDirectory(activeId);
    const { options, providerNames } = useModelOptions();

    return (
        <SessionView
            sessionId={activeId}
            sessionDirectory={directory}
            modelOptions={options}
            providerNames={providerNames}
            providersPath={paths.settingsPage("providers")}
            onCreateSession={async (newDirectory) => {
                const id = await createSession(newDirectory);
                void navigate(paths.session(id));
                return id;
            }}
        />
    );
}
