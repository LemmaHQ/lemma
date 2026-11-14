import { code } from "@streamdown/code";
import { useCopyText } from "#hooks/use-copy-text";
import { DrawerHeadingContext } from "#hooks/use-drawer-heading";
import { CheckIcon } from "#icons/check";
import { CopyIcon } from "#icons/copy";
import { XIcon } from "#icons/x";
import { cn } from "#lib/cn";
import { Button } from "#primitives/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "#primitives/tooltip";
import { type ReactNode, useContext, useMemo } from "react";
import {
    CodeBlock as StreamdownCodeBlock,
    StreamdownContext,
} from "streamdown";

type DetailPaneWebHit = {
    id: string;
    title: string;
    url: string;
    snippet?: string | undefined;
};

export type DetailPaneBody =
    | { kind: "prose"; content: ReactNode }
    | {
          kind: "code";
          code: string;
          language?: string | undefined;
          copyLabel?: string | undefined;
          copiedLabel?: string | undefined;
      }
    | { kind: "web"; note?: string | undefined; hits: DetailPaneWebHit[] }
    | { kind: "output"; content: string; warn?: boolean | undefined };

export type DetailPaneProps = {
    verb: string;
    title: string;
    meta?: string | undefined;
    closeLabel: string;
    onClose: () => void;
    body: DetailPaneBody;
    className?: string | undefined;
};

function DetailCodeBody({
    codeText,
    language,
    copyLabel,
    copiedLabel,
}: {
    codeText: string;
    language: string;
    copyLabel?: string | undefined;
    copiedLabel?: string | undefined;
}) {
    const { copied, copy } = useCopyText();
    const baseContext = useContext(StreamdownContext);
    const contextValue = useMemo(
        () => ({
            ...baseContext,
            plugins: { code },
            controls: false,
            lineNumbers: true,
        }),
        [baseContext],
    );

    return (
        <div data-language={language === "" ? undefined : language}>
            <StreamdownContext.Provider value={contextValue}>
                <StreamdownCodeBlock
                    code={codeText}
                    language={language}
                    lineNumbers
                >
                    {copyLabel !== undefined && (
                        <Tooltip>
                            <TooltipTrigger
                                render={
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-xs"
                                        aria-label={
                                            copied
                                                ? (copiedLabel ?? copyLabel)
                                                : copyLabel
                                        }
                                        onClick={() => copy(codeText)}
                                    />
                                }
                            >
                                {copied ? <CheckIcon /> : <CopyIcon />}
                            </TooltipTrigger>
                            <TooltipContent>
                                {copied
                                    ? (copiedLabel ?? copyLabel)
                                    : copyLabel}
                            </TooltipContent>
                        </Tooltip>
                    )}
                </StreamdownCodeBlock>
            </StreamdownContext.Provider>
        </div>
    );
}

/** Slide-in detail pane with a 52px header and typed prose, highlighted code, web, or output body. */
export function DetailPane({
    verb,
    title,
    meta,
    closeLabel,
    onClose,
    body,
    className,
}: DetailPaneProps) {
    const headingId = useContext(DrawerHeadingContext);

    return (
        <div
            data-slot="detail-pane"
            className={cn("flex min-h-0 flex-1 flex-col", className)}
        >
            <header className="flex h-13 shrink-0 items-center gap-3 border-b border-border px-4">
                <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-caption font-medium text-muted-foreground">
                    {verb}
                </span>
                <h2
                    id={headingId}
                    className="min-w-0 flex-1 truncate text-body font-medium text-foreground"
                >
                    <Tooltip>
                        <TooltipTrigger
                            render={<span className="block truncate" />}
                        >
                            {title}
                        </TooltipTrigger>
                        <TooltipContent>{title}</TooltipContent>
                    </Tooltip>
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
                    <DetailCodeBody
                        codeText={body.code}
                        language={body.language ?? ""}
                        copyLabel={body.copyLabel}
                        copiedLabel={body.copiedLabel}
                    />
                )}
                {body.kind === "web" && (
                    <div className="flex flex-col gap-2">
                        {body.note !== undefined && (
                            <p className="text-small text-muted-foreground">
                                {body.note}
                            </p>
                        )}
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
