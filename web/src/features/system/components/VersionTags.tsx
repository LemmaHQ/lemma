import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { loadServerVersion } from "../store";

function VersionTag({ children }: { children: string }) {
    return (
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {children}
        </span>
    );
}

/** Server version; an unreachable server shows no tag. */
export function VersionTags() {
    const { t } = useTranslation();
    const [serverVersion, setServerVersion] = useState<string | null>(null);

    useEffect(() => {
        void loadServerVersion().then(setServerVersion);
    }, []);

    return (
        <div className="flex items-center gap-1.5">
            {serverVersion !== null && (
                <VersionTag>
                    {t("version.server", { version: serverVersion })}
                </VersionTag>
            )}
        </div>
    );
}
