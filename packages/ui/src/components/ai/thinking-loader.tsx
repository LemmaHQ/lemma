import { cn } from "cn";

const RAYS = Array.from({ length: 8 }, (_, index) => index);

type ThinkingLoaderProps = {
    label: string;
    className?: string;
};

export function ThinkingLoader({ label, className }: ThinkingLoaderProps) {
    return (
        <span
            className={cn(
                "mb-4 inline-flex h-8 items-center gap-2 rounded-full border border-border bg-background px-3 text-sm text-muted-foreground",
                className,
            )}
            role="status"
        >
            <ThinkingStatusIcon />
            <ShimmerLabel>{label}</ShimmerLabel>
        </span>
    );
}

type ThinkingStatusIconProps = {
    done?: boolean;
};

export function ThinkingStatusIcon({ done = false }: ThinkingStatusIconProps) {
    return (
        <span
            className="status-swap relative inline-block size-4 flex-none"
            data-done={done}
            aria-hidden="true"
        >
            <svg
                className="absolute inset-0 block size-full overflow-visible fill-none"
                data-part="spinner"
                viewBox="0 0 16 16"
            >
                {RAYS.map((index) => (
                    <line
                        className="animate-ray stroke-current stroke-[1.6] [stroke-linecap:round]"
                        key={index}
                        style={{ "--ray-index": index }}
                        transform={`rotate(${index * 45} 8 8)`}
                        x1="8"
                        x2="8"
                        y1="1.75"
                        y2="4.75"
                    />
                ))}
            </svg>
            <svg
                className="absolute inset-0 block size-full overflow-visible fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]"
                data-part="check"
                viewBox="0 0 16 16"
            >
                <path d="M3.5 8.4 6.6 11.3 12.5 4.9" pathLength={1} />
            </svg>
        </span>
    );
}

function ShimmerLabel({ children }: { children: string }) {
    return <span className="text-sweep">{children}</span>;
}
