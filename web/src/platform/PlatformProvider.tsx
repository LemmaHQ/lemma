import type { ReactNode } from "react";

import { PlatformContext } from "./context";
import { getPlatform } from "./instance";
import type { PlatformAdapter } from "./types";

export function PlatformProvider({
    children,
    adapter,
}: {
    children: ReactNode;
    adapter?: PlatformAdapter;
}) {
    const value = adapter ?? getPlatform();
    return (
        <PlatformContext.Provider value={value}>
            {children}
        </PlatformContext.Provider>
    );
}
