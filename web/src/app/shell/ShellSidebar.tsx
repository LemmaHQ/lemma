import { use, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { ShellContext } from "./shell-context";

/** Renders the current page's sidebar body inside the shell's sidebar. */
export function ShellSidebar({ children }: { children: ReactNode }) {
    const target = use(ShellContext)?.sidebarTarget ?? null;
    return target === null ? null : createPortal(children, target);
}
