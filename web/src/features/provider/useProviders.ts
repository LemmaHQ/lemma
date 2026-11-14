import { createLoadedHook } from "@/store/loaded-hook";

import { useProviderStore } from "./store";

export const useProviders = createLoadedHook(useProviderStore);
