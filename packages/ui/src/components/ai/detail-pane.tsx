import { XIcon } from "#icons/x";
import { cn } from "#lib/cn";
import { Button } from "#primitives/button";
import type { ReactNode } from "react";

export type DetailPaneWebHit = {
    id: string;
    title: string;
    url: string;
    snippet?: string;
};

export type DetailPaneBody =
    | { kind: "prose"; content: ReactNode }
    | { kind: "code"; code: string; language?: string }
    | { kind: "web"; hits: DetailPaneWebHit[] }
    | { kind: "output"; content: string; warn?: boolean };

export type DetailPaneProps = {
    verb: string;
    title: string;
    meta?: string;
    closeLabel: string;
    onClose: () => void;
    body: DetailPaneBody;
    className?: string;
};

/** Slide-in detail pane with a 52px header and typed prose, code, web, or output body. */
export function DetailPane({
    verb,
    title,
    meta,
    closeLabel,
    onClose,
    body,
    className,
}: DetailPaneProps) {
    return (
        <div
            data-slot="detail-pane"
            className={cn("flex min-h-0 flex-1 flex-col", className)}
        >
            <header className="flex h-13 shrink-0 items-center gap-3 border-b border-border px-4">
                <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-caption font-medium text-muted-foreground">
                    {verb}
                </span>
                <h2 className="min-w-0 flex-1 truncate text-body font-medium text-foreground">
                    {title}
                </h2>
                {meta !== undefined && (
                    <span className="shrink-0 text-caption text-subtle-foreground tabular-nums">
                        {meta}
                    </span>
                )}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={closeLabel}
                    onClick={onClose}
                >
                    <XIcon />
                </Button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {body.kind === "prose" && (
                    <div className="text-reading text-foreground">
                        {body.content}
                    </div>
                )}
                {body.kind === "code" && (
                    <div
                        data-language={body.language}
                        className="overflow-x-auto rounded-md border border-border bg-muted py-3 font-mono text-small"
                    >
                        {body.code
                            .split("\n")
                            .map((text, index) => ({
                                lineNumber: index + 1,
                                text,
                            }))
                            .map((entry) => (
                                <div
                                    key={entry.lineNumber}
                                    className="flex px-3"
                                >
                                    <span
                                        aria-hidden="true"
                                        className="w-10 shrink-0 pr-3 text-right text-subtle-foreground tabular-nums select-none"
                                    >
                                        {entry.lineNumber}
                                    </span>
                                    <span className="whitespace-pre text-foreground">
                                        {entry.text}
                                    </span>
                                </div>
                            ))}
                    </div>
                )}
                {body.kind === "web" && (
                    <div className="flex flex-col gap-2">
                        {body.hits.map((hit) => (
                            <a
                                key={hit.id}
                                href={hit.url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex flex-col gap-1 rounded-md border border-border p-3 transition-colors duration-base hover:bg-accent"
                            >
                                <span className="text-body font-medium text-foreground">
                                    {hit.title}
                                </span>
                                <span className="truncate font-mono text-caption text-brand">
                                    {hit.url}
                                </span>
                                {hit.snippet !== undefined && (
                                    <span className="text-small text-muted-foreground">
                                        {hit.snippet}
                                    </span>
                                )}
                            </a>
                        ))}
                    </div>
                )}
                {body.kind === "output" && (
                    <pre
                        className={cn(
                            "overflow-x-auto rounded-md border border-border bg-muted p-3 font-mono text-small whitespace-pre-wrap",
                            body.warn === true
                                ? "text-destructive"
                                : "text-foreground",
                        )}
                    >
                        {body.content}
                    </pre>
                )}
            </div>
        </div>
    );
}
