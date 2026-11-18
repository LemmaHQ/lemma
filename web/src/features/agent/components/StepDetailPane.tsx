import {
    cn,
    CodeBlock,
    CopyButton,
    DrawerHeader,
    Markdown,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@lemma/ui";
import { useTranslation } from "react-i18next";

import type { DetailPayload } from "../step-details";

function DetailBody({
    detail,
    warn,
}: {
    detail: DetailPayload;
    warn: boolean;
}) {
    const { t } = useTranslation();

    switch (detail.kind) {
        case "prose":
            return (
                <div className="text-reading text-foreground">
                    <Markdown>{detail.text}</Markdown>
                </div>
            );
        case "code":
            return (
                <CodeBlock
                    code={detail.code}
                    language={detail.language ?? ""}
                    actions={
                        <CopyButton
                            text={detail.code}
                            label={t("common.copyCode")}
                            copiedLabel={t("common.copied")}
                        />
                    }
                />
            );
        case "web":
            return (
                <div className="flex flex-col gap-2">
                    {detail.note !== undefined && (
                        <p className="text-small text-muted-foreground">
                            {detail.note}
                        </p>
                    )}
                    {detail.hits.map((hit) => (
                        <a
                            key={hit.url}
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
                            {hit.snippet !== "" && (
                                <span className="text-small text-muted-foreground">
                                    {hit.snippet}
                                </span>
                            )}
                        </a>
                    ))}
                </div>
            );
        case "output":
            return (
                <pre
                    className={cn(
                        "overflow-x-auto rounded-md border border-border bg-muted p-3 font-mono text-small whitespace-pre-wrap",
                        warn ? "text-destructive" : "text-foreground",
                    )}
                >
                    {detail.text}
                </pre>
            );
    }
}

/** Drawer contents for a timeline step or a reply's code block: the header, then prose, code, web hits, or output. */
export function StepDetailPane({
    verb,
    title,
    meta,
    detail,
    warn,
    onClose,
}: {
    verb: string;
    title: string;
    meta: string | undefined;
    detail: DetailPayload;
    warn: boolean;
    onClose: () => void;
}) {
    const { t } = useTranslation();

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <DrawerHeader
                verb={verb}
                title={
                    <Tooltip>
                        <TooltipTrigger
                            render={<span className="block truncate" />}
                        >
                            {title}
                        </TooltipTrigger>
                        <TooltipContent>{title}</TooltipContent>
                    </Tooltip>
                }
                closeLabel={t("common.close")}
                meta={
                    meta === undefined ? undefined : (
                        <span className="text-caption text-subtle-foreground tabular-nums">
                            {meta}
                        </span>
                    )
                }
                onClose={onClose}
            />
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <DetailBody detail={detail} warn={warn} />
            </div>
        </div>
    );
}
