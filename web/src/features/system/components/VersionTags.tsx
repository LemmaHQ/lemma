import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { getPlatform } from "@/platform/platform";

import { loadServerVersion } from "../store";

function VersionTag({ children }: { children: string }) {
    return (
        <span className="rounded-md bg-muted px-2 py-0.5 text-caption text-muted-foreground">
            {children}
        </span>
    );
}

/** Server version, plus the client version in the desktop app; an unreachable server shows no tag. */
export function VersionTags() {
    const { t } = useTranslation();
    const clientVersion = getPlatform().clientVersion;
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
            {clientVersion !== null && (
                <VersionTag>
                    {t("version.client", { version: clientVersion })}
                </VersionTag>
            )}
        </div>
    );
}
