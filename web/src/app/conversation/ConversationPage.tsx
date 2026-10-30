import { useNavigate, useParams } from "react-router";

import { ConversationView } from "@/features/agent";
import { createConversation } from "@/features/conversations";
import { useModelOptions } from "@/features/providers";

import { paths } from "../route-paths";

export function ConversationPage() {
    const navigate = useNavigate();
    const activeId = useParams().id ?? null;
    const { options, providerNames } = useModelOptions();

    return (
        <ConversationView
            conversationId={activeId}
            modelOptions={options}
            providerNames={providerNames}
            providersPath={paths.settingsSection("providers")}
            onCreateConversation={async () => {
                const id = await createConversation();
                void navigate(paths.conversation(id));
                return id;
            }}
        />
    );
}
