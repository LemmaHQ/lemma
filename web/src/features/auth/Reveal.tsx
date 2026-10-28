import { motion, useReducedMotion, type Transition } from "motion/react";
import type { ReactNode } from "react";

function numbers(value: string) {
    return (value.match(/[\d.]+/gu) ?? []).map(Number);
}

function slowMove(): Transition {
    const style = getComputedStyle(document.documentElement);
    const duration = style.getPropertyValue("--motion-duration-slow").trim();
    const [value = 0] = numbers(duration);
    const [x1 = 0, y1 = 0, x2 = 1, y2 = 1] = numbers(
        style.getPropertyValue("--motion-easing-move"),
    );
    return {
        duration: duration.endsWith("ms") ? value / 1000 : value,
        ease: [x1, y1, x2, y2],
    };
}

/**
 * Expands from zero height and fades in on mount, and collapses on exit
 * inside `AnimatePresence`, with the slow duration and move easing tokens.
 * A 4px inset keeps focus rings of the content inside the clip.
 */
export function Reveal({ children }: { children: ReactNode }) {
    const reduceMotion = useReducedMotion();

    return (
        <motion.div
            className="-mx-1 -mb-1 overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduceMotion === true ? { duration: 0 } : slowMove()}
        >
            <div className="px-1 pb-1">{children}</div>
        </motion.div>
    );
}
