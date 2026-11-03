import { useNavigate, useParams } from "react-router";

import { SessionView } from "@/features/agent";
import { createSession } from "@/features/session";
import { useModelOptions } from "@/features/providers";

import { paths } from "../route-paths";

export function SessionPage() {
    const navigate = useNavigate();
    const activeId = useParams().id ?? null;
    const { options, providerNames } = useModelOptions();

    return (
        <SessionView
            sessionId={activeId}
            modelOptions={options}
            providerNames={providerNames}
            providersPath={paths.settingsSection("providers")}
            onCreateSession={async () => {
                const id = await createSession();
                void navigate(paths.session(id));
                return id;
            }}
        />
    );
}
