import { NewConversationButton } from "./NewConversationButton";
import { SidebarToggleButton } from "./SidebarToggleButton";

/** Raised toolbar at the top left of the page while the sidebar is hidden. */
export function ShellToolbar({
    newConversation,
}: {
    newConversation: boolean;
}) {
    return (
        <div className="flex items-center gap-0.5 rounded-lg border bg-background p-0.5 shadow-raised">
            <SidebarToggleButton />
            {newConversation && <NewConversationButton compact />}
        </div>
    );
}
