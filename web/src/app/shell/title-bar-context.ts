import { createContext } from "react";

/** The page surface the title bar matches: the shell sidebar or the page background. */
export type TitleBarSurface = "sidebar" | "background";

export const TitleBarContext = createContext<
    ((surface: TitleBarSurface) => void) | null
>(null);
