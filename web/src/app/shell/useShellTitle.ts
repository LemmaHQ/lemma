import { use, useLayoutEffect } from "react";

import { ShellContext } from "./shell-context";

/** Shows `title` in the shell header while the calling page is mounted; `undefined` leaves the header untitled. */
export function useShellTitle(title: string | undefined) {
    const setTitle = use(ShellContext)?.setTitle;
    useLayoutEffect(() => {
        setTitle?.(title);
    }, [setTitle, title]);
}
