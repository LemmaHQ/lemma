import {
    DrawerLayout,
    FollowScroll,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    useFollowScroll,
} from "@lemma/ui";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface StageTurn {
    id: string;
    label: string;
}

function TurnOutline({ turns }: { turns: StageTurn[] }) {
    const { t } = useTranslation();
    const { scrollIntoView } = useFollowScroll();

    return (
        <nav
            aria-label={t("session.outlineLabel")}
            className="pointer-events-none absolute top-1/2 right-3 z-20 hidden -translate-y-1/2 flex-col items-end gap-1.5 md:flex"
        >
            {turns.map((turn, index) => (
                <Tooltip key={turn.id}>
                    <TooltipTrigger
                        render={
                            <button
                                type="button"
                                aria-label={t("session.jumpToTurn", {
                                    index: index + 1,
                                })}
                                onClick={() =>
                                    scrollIntoView(
                                        `[data-turn-id="${CSS.escape(turn.id)}"]`,
                                    )
                                }
                                className="group pointer-events-auto flex cursor-pointer items-center gap-2 py-0.5 outline-none"
                            />
                        }
                    >
                        <span className="h-0.5 w-3 rounded-full bg-input transition-all duration-base group-hover:w-5 group-hover:bg-foreground group-focus-visible:w-5 group-focus-visible:bg-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="left">{turn.label}</TooltipContent>
                </Tooltip>
            ))}
        </nav>
    );
}

/** The 680px column that holds the composer at the bottom of a session page. */
export function StageComposer({ children }: { children: ReactNode }) {
    return (
        <div className="shrink-0 px-4 pb-4 md:px-6">
            <div className="mx-auto w-full max-w-170">{children}</div>
        </div>
    );
}

/**
 * Centered 680px reading stage that follows new turns, with right-edge ticks that jump to each turn,
 * the composer at the bottom, and `drawer` sliding in from the right while set.
 */
export function SessionStage({
    turns,
    followTrigger,
    drawer,
    drawerId,
    onCloseDrawer,
    composer,
    children,
}: {
    turns: StageTurn[];
    followTrigger: unknown;
    drawer: ReactNode | undefined;
    drawerId: string;
    onCloseDrawer: () => void;
    composer: ReactNode;
    children: ReactNode;
}) {
    const { t } = useTranslation();

    return (
        <DrawerLayout
            drawer={drawer}
            drawerId={drawerId}
            onClose={onCloseDrawer}
        >
            <FollowScroll
                followTrigger={followTrigger}
                scrollToBottomLabel={t("session.scrollToBottom")}
                overlay={
                    drawer === undefined && turns.length > 0 ? (
                        <TurnOutline turns={turns} />
                    ) : undefined
                }
            >
                <div className="mx-auto w-full max-w-170 px-4 pt-6 pb-8 md:px-6">
                    {children}
                </div>
            </FollowScroll>
            <StageComposer>{composer}</StageComposer>
        </DrawerLayout>
    );
}
