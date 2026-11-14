import { createLoadedHook } from "@/store/loaded-hook";

import { useWebProviderStore } from "./store";

export const useWebProviders = createLoadedHook(useWebProviderStore);
