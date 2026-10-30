import { ScrollArea } from "@lemma/ui";

import { AppearancePanel } from "@/features/preferences";

export function AppearanceSettingsPage() {
    return (
        <ScrollArea className="min-h-0 flex-1">
            <AppearancePanel />
        </ScrollArea>
    );
}
