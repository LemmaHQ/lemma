import { useEffect } from "react";
import { Outlet, useNavigate, useParams } from "react-router";

import { useSessionDirectory, useSessionStore } from "@/features/session";

import { paths } from "../route-paths";
import { ShellFrame } from "../shell/ShellFrame";
import { SessionSidebar } from "./SessionSidebar";

/** The layout route of home and the sessions, owning session directory selection and the Ctrl/Cmd+N shortcut. */
export function SessionLayout() {
    const navigate = useNavigate();
    const activeId = useParams().id ?? null;
    const directoryState = useSessionDirectory(activeId);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (
                (event.ctrlKey || event.metaKey) &&
                !event.shiftKey &&
                !event.altKey &&
                event.key.toLowerCase() === "n"
            ) {
                event.preventDefault();
                void navigate(paths.home);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [navigate]);

    useEffect(() => {
        if (activeId !== null) {
            useSessionStore.getState().markSeen(activeId);
        }
    }, [activeId]);

    return (
        <ShellFrame
            sidebar={
                <SessionSidebar
                    activeId={activeId}
                    directoryState={directoryState}
                />
            }
        >
            <Outlet context={directoryState} />
        </ShellFrame>
    );
}
