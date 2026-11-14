import { cn } from "#lib/cn";

export type WordmarkProps = {
    label: string;
    className?: string;
};

/** Brand wordmark set in NewCM with a trailing brand dot. */
export function Wordmark({ label, className }: WordmarkProps) {
    return (
        <span
            data-slot="wordmark"
            className={cn(
                "font-brand text-[19px]/6 text-foreground select-none",
                className,
            )}
        >
            {label}
            <span
                aria-hidden="true"
                className="ml-0.5 inline-block size-[5px] rounded-full bg-brand align-[0.72em]"
            />
        </span>
    );
}
