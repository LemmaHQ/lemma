import { cn } from "#lib/cn";
import {
    type ReactNode,
    type UIEvent,
    useEffect,
    useRef,
    useState,
} from "react";

export type SessionStageTurn = {
    id: string;
    label: string;
};

export type SessionStageProps = {
    paned?: boolean;
    turns?: SessionStageTurn[];
    rightPane?: ReactNode;
    onClosePane?: () => void;
    composer?: ReactNode;
    outlineLabel?: string;
    children: ReactNode;
    className?: string;
};

/**
 * Centered 680px reading stage with sticky-card scroll shade, right-edge turn
 * outline ticks, bottom composer dock, and a 480px slide-in detail drawer.
 */
export function SessionStage({
    paned = false,
    turns,
    rightPane,
    onClosePane,
    composer,
    outlineLabel,
    children,
    className,
}: SessionStageProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [stuck, setStuck] = useState(false);

    useEffect(() => {
        if (!paned || onClosePane === undefined) {
            return;
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClosePane();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [paned, onClosePane]);

    const handleScroll = (event: UIEvent<HTMLDivElement>) => {
        const container = event.currentTarget;
        const containerTop = container.getBoundingClientRect().top;
        const cards =
            container.querySelectorAll<HTMLElement>("[data-say-card]");
        const anyStuck =
            container.scrollTop > 0 &&
            Array.from(cards).some(
                (card) => card.getBoundingClientRect().top <= containerTop + 12,
            );
        setStuck(anyStuck);
    };

    const scrollToTurn = (turnId: string) => {
        const escaped = turnId.replaceAll('"', '\\"');
        const target = scrollRef.current?.querySelector<HTMLElement>(
            `[data-turn-id="${escaped}"]`,
        );
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    return (
        <div
            data-slot="session-stage"
            data-paned={paned ? "" : undefined}
            className={cn(
                "relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background",
                className,
            )}
        >
            <div
                className={cn(
                    "flex min-h-0 flex-1 flex-col transition-[padding] duration-slow ease-enter motion-reduce:transition-none",
                    paned && "lg:pr-120",
                )}
            >
                <div
                    ref={scrollRef}
                    data-slot="session-stage-scroll"
                    onScroll={handleScroll}
                    className="min-h-0 flex-1 overflow-y-auto"
                >
                    <div
                        aria-hidden="true"
                        data-slot="stage-shade"
                        data-stuck={stuck ? "" : undefined}
                        className={cn(
                            "pointer-events-none sticky top-0 z-20 -mb-8 h-8 bg-linear-to-b from-background to-transparent transition-opacity duration-base",
                            stuck ? "opacity-100" : "opacity-0",
                        )}
                    />
                    <div className="mx-auto w-full max-w-170 px-4 pt-6 pb-8 md:px-6">
                        {children}
                    </div>
                </div>
                {composer !== undefined && (
                    <div className="shrink-0 px-4 pb-4 md:px-6">
                        <div className="mx-auto w-full max-w-170">
                            {composer}
                        </div>
                    </div>
                )}
            </div>

            {!paned && turns !== undefined && turns.length > 0 && (
                <nav
                    data-slot="turn-outline"
                    aria-label={outlineLabel}
                    className="pointer-events-none absolute top-1/2 right-3 z-20 hidden -translate-y-1/2 flex-col items-end gap-1.5 md:flex"
                >
                    {turns.map((turn) => (
                        <button
                            key={turn.id}
                            type="button"
                            aria-label={turn.label}
                            onClick={() => scrollToTurn(turn.id)}
                            className="group pointer-events-auto flex cursor-pointer items-center gap-2 py-0.5 outline-none"
                        >
                            <span className="h-0.5 w-3 rounded-full bg-input transition-all duration-base group-hover:w-5 group-hover:bg-foreground group-focus-visible:w-5 group-focus-visible:bg-foreground" />
                        </button>
                    ))}
                </nav>
            )}

            {paned && rightPane !== undefined && (
                <aside
                    data-slot="detail-drawer"
                    className="slide-in-from-right animate-in fade-in-0 absolute inset-y-0 right-0 z-30 flex w-full flex-col border-l border-border bg-background shadow-overlay duration-slow ease-enter lg:w-120 motion-reduce:animate-none"
                >
                    {rightPane}
                </aside>
            )}
        </div>
    );
}
