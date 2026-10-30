import { systemClient } from "@/rpc/clients";

export async function loadServerVersion(): Promise<string | null> {
    try {
        return (await systemClient.getVersion({})).version;
    } catch {
        return null;
    }
}
