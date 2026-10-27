import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { systemClient } from "@/data/rpc/clients";
import { useClientVersion } from "@/platform/hooks";

async function loadServerVersion(): Promise<string | null> {
    try {
        return (await systemClient.getVersion({})).version;
    } catch {
        return null;
    }
}

function VersionTag({ children }: { children: string }) {
    return (
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {children}
        </span>
    );
}

/** Server version, plus the client version in the desktop app; an unreachable server shows no tag. */
export function VersionTags() {
    const { t } = useTranslation();
    const clientVersion = useClientVersion();
    const [serverVersion, setServerVersion] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        const load = async () => {
            const version = await loadServerVersion();
            if (active) {
                setServerVersion(version);
            }
        };
        void load();
        return () => {
            active = false;
        };
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
