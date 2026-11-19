import { cn } from "#lib/cn";

type WordmarkProps = {
    label: string;
    size?: "default" | "splash" | undefined;
};

/** Brand wordmark set in NewCM (19px sidebar default or 24px splash scale) with a trailing brand dot. */
export function Wordmark({ label, size = "default" }: WordmarkProps) {
    return (
        <span
            data-slot="wordmark"
            className={cn(
                "font-brand text-foreground select-none",
                size === "splash" ? "text-wordmark-splash" : "text-wordmark",
            )}
        >
            {label}
            <span
                aria-hidden="true"
                className={cn(
                    "ml-0.5 inline-block rounded-full bg-brand",
                    size === "splash"
                        ? "relative bottom-3 size-1.5"
                        : "size-1.25 align-[0.72em]",
                )}
            />
        </span>
    );
}
