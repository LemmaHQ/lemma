import { useEffect, useState } from "react";

const TICK_MS = 100;

/** Returns elapsed milliseconds, ticking while the interval is unfinished. */
export function useStopwatch(
    startedAt?: number,
    finishedAt?: number,
): number | undefined {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (startedAt === undefined || finishedAt !== undefined) {
            return;
        }
        const timer = window.setInterval(() => {
            setNow(Date.now());
        }, TICK_MS);
        return () => {
            window.clearInterval(timer);
        };
    }, [startedAt, finishedAt]);

    if (startedAt === undefined) {
        return undefined;
    }
    return Math.max(0, (finishedAt ?? now) - startedAt);
}
