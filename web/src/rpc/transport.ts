import { createConnectTransport } from "@connectrpc/connect-web";

import { getPlatform } from "@/platform/platform";

const platform = getPlatform();

export const transport = createConnectTransport({
    baseUrl: platform.baseUrl,
    fetch: platform.fetch,
});
