import { cn } from "cn";

type ShimmerProps = {
    children: string;
    className?: string;
};

export function Shimmer({ children, className }: ShimmerProps) {
    return <span className={cn("text-sweep", className)}>{children}</span>;
}
