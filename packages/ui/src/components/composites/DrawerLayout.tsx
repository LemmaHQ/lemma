import { XIcon } from "#icons/x";
import { cn } from "#lib/cn";
import { Button } from "#primitives/button";
import {
    createContext,
    type ReactNode,
    useContext,
    useEffect,
    useId,
    useRef,
} from "react";

const DrawerHeadingContext = createContext<string | undefined>(undefined);

/**
 * A main column with a 480px drawer that slides in from the right while `drawer` is set.
 * From `lg` up the column pads to stay beside the drawer; below it a scrim covers the column.
 * The open drawer takes focus and returns it on close; Escape or a scrim click calls `onClose`.
 */
export function DrawerLayout({
    drawer,
    drawerId,
    onClose,
    children,
}: {
    drawer: ReactNode | undefined;
    drawerId: string;
    onClose: () => void;
    children: ReactNode;
}) {
    const headingId = useId();
    const drawerRef = useRef<HTMLElement>(null);
    const open = drawer !== undefined;

    useEffect(() => {
        if (!open) {
            return;
        }
        const restoreTarget = document.activeElement;
        drawerRef.current?.focus({ preventScroll: true });
        return () => {
            if (
                restoreTarget instanceof HTMLElement &&
                restoreTarget.isConnected
            ) {
                restoreTarget.focus({ preventScroll: true });
            }
        };
    }, [open]);

    useEffect(() => {
        if (!open) {
            return;
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !event.defaultPrevented) {
                event.stopPropagation();
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, onClose]);

    return (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
            <div
                className={cn(
                    "flex min-h-0 flex-1 flex-col transition-[padding] duration-slow ease-enter motion-reduce:transition-none",
                    open && "lg:pr-120",
                )}
            >
                {children}
            </div>
            {open && (
                <>
                    <div
                        aria-hidden="true"
                        data-slot="drawer-scrim"
                        onClick={onClose}
                        className="fade-in-0 animate-in absolute inset-0 z-20 bg-scrim duration-base lg:hidden motion-reduce:animate-none"
                    />
                    <DrawerHeadingContext value={headingId}>
                        <aside
                            id={drawerId}
                            ref={drawerRef}
                            tabIndex={-1}
                            aria-labelledby={headingId}
                            className="slide-in-from-right animate-in fade-in-0 absolute inset-y-0 right-0 z-30 flex w-full flex-col border-l border-border bg-background shadow-overlay duration-slow ease-enter outline-none lg:w-120 motion-reduce:animate-none"
                        >
                            {drawer}
                        </aside>
                    </DrawerHeadingContext>
                </>
            )}
        </div>
    );
}

/**
 * The 52px header of a `DrawerLayout` drawer: a `verb` badge, the `title` heading that names the drawer,
 * `children` after it, and `meta` beside the close button at the end.
 */
export function DrawerHeader({
    verb,
    title,
    meta,
    closeLabel,
    onClose,
    children,
}: {
    verb: string;
    title: ReactNode;
    meta?: ReactNode;
    closeLabel: string;
    onClose: () => void;
    children?: ReactNode;
}) {
    const headingId = useContext(DrawerHeadingContext);

    return (
        <header className="flex h-13 shrink-0 items-center gap-3 border-b border-border px-4">
            <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-caption font-medium text-muted-foreground">
                {verb}
            </span>
            <h2
                id={headingId}
                className="min-w-0 truncate text-body font-medium text-foreground"
            >
                {title}
            </h2>
            {children}
            <div className="ml-auto flex shrink-0 items-center gap-3">
                {meta}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={closeLabel}
                    onClick={onClose}
                >
                    <XIcon />
                </Button>
            </div>
        </header>
    );
}
