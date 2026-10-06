import { createContext } from "react";

import { getPlatform } from "./instance";
import type { PlatformAdapter } from "./types";

export const PlatformContext = createContext<PlatformAdapter>(getPlatform());
