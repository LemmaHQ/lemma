import { cn } from "cn";
import { motion, useReducedMotion } from "motion/react";

const SWEEP_SECONDS = 2;
const SPREAD_PX_PER_CHARACTER = 2;

type ShimmerProps = {
    children: string;
    className?: string;
};

export function Shimmer({ children, className }: ShimmerProps) {
    const reduceMotion = useReducedMotion();
    if (reduceMotion === true) {
        return (
            <span className={cn("text-muted-foreground", className)}>
                {children}
            </span>
        );
    }
    return (
        <motion.span
            animate={{ backgroundPosition: "0% center" }}
            className={cn(
                "inline-block bg-size-[250%_100%,auto] bg-clip-text bg-no-repeat text-transparent",
                "bg-[linear-gradient(90deg,transparent_calc(50%-var(--shimmer-spread)),var(--color-background),transparent_calc(50%+var(--shimmer-spread))),linear-gradient(var(--color-muted-foreground),var(--color-muted-foreground))]",
                className,
            )}
            initial={{ backgroundPosition: "100% center" }}
            style={{
                "--shimmer-spread": `${children.length * SPREAD_PX_PER_CHARACTER}px`,
            }}
            transition={{
                duration: SWEEP_SECONDS,
                ease: "linear",
                repeat: Number.POSITIVE_INFINITY,
            }}
        >
            {children}
        </motion.span>
    );
}
