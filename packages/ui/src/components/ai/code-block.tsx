import { cn } from "#lib/cn";
import {
    type CSSProperties,
    type ComponentProps,
    useCallback,
    useEffect,
    useId,
    useState,
} from "react";
import {
    type BundledLanguage,
    type Highlighter,
    createHighlighter,
} from "shiki";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

import { Button } from "#primitives/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "#primitives/tooltip";
import { useCopyText } from "#hooks/use-copy-text";
import { CheckIcon } from "#icons/check";
import { CopyIcon } from "#icons/copy";

let highlighter: Promise<Highlighter> | undefined;

async function highlight(code: string, language: BundledLanguage) {
    highlighter ??= createHighlighter({
        themes: ["one-light", "one-dark-pro"],
        langs: [],
        engine: createJavaScriptRegexEngine(),
    });
    const loaded = await highlighter;
    await loaded.loadLanguage(language);
    return loaded.codeToHtml(code, {
        lang: language,
        themes: { light: "one-light", dark: "one-dark-pro" },
        defaultColor: "light-dark()",
    });
}

type CodeBlockProps = ComponentProps<"div"> & {
    code: string;
    language: BundledLanguage;
};

export function CodeBlock({
    code,
    language,
    className,
    ...props
}: CodeBlockProps) {
    const [html, setHtml] = useState("");

    useEffect(() => {
        let current = true;
        const render = async () => {
            const highlighted = await highlight(code, language);
            if (current) {
                setHtml(highlighted);
            }
        };
        void render();
        return () => {
            current = false;
        };
    }, [code, language]);

    return (
        <div
            className={cn(
                "relative w-full overflow-hidden rounded-md border bg-muted text-foreground",
                className,
            )}
            {...props}
        >
            <div
                className="overflow-auto [&_code]:font-mono [&_code]:text-small [&>pre]:m-0 [&>pre]:bg-muted! [&>pre]:p-4 [&>pre]:text-small [&>pre]:text-foreground!"
                dangerouslySetInnerHTML={{ __html: html }}
            />
        </div>
    );
}

export type CodeBlockSectionLabels = {
    copy: string;
    copied: string;
    showAll: string;
    showLess: string;
};

type CodeBlockSectionProps = {
    label: string;
    labels: CodeBlockSectionLabels;
    value: unknown;
    cap: number;
};

export function CodeBlockSection({
    label,
    labels,
    value,
    cap,
}: CodeBlockSectionProps) {
    const id = useId();
    const [full, setFull] = useState(false);
    const [height, setHeight] = useState(0);
    const text = toText(value);
    const measureCode = useCallback((element: HTMLDivElement) => {
        const measure = () => setHeight(element.scrollHeight);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        for (const child of Array.from(element.children)) {
            observer.observe(child);
        }
        return () => observer.disconnect();
    }, []);

    const capped = height > cap + 24;
    const maxHeight = capped ? (full ? height : cap) : undefined;
    const style =
        maxHeight === undefined
            ? undefined
            : ({
                  "--tool-call-code-height": `${maxHeight}px`,
              } as CSSProperties);

    return (
        <div className="grid min-w-0 gap-1.5">
            <div className="flex min-h-6 items-center justify-between gap-2">
                <span className="text-caption font-medium text-subtle-foreground">
                    {label}
                </span>
                <CopyButton
                    copiedLabel={labels.copied}
                    label={labels.copy}
                    text={text}
                />
            </div>
            <div
                id={id}
                ref={measureCode}
                className="relative max-h-(--tool-call-code-height) overflow-hidden rounded-md transition-[max-height] duration-reveal ease-enter after:pointer-events-none after:absolute after:inset-x-px after:bottom-px after:h-14 after:rounded-b-md after:bg-linear-to-b after:from-transparent after:to-muted after:opacity-0 after:transition-opacity after:duration-medium after:ease-enter after:content-[''] data-[capped=true]:after:opacity-100 motion-reduce:transition-none motion-reduce:after:transition-none"
                data-capped={capped && !full}
                style={style}
            >
                <CodeBlock code={text} language="json" />
            </div>
            {capped && (
                <Button
                    type="button"
                    className="justify-self-start"
                    size="xs"
                    variant="ghost"
                    aria-controls={id}
                    aria-expanded={full}
                    onClick={() => setFull(!full)}
                >
                    {full ? labels.showLess : labels.showAll}
                </Button>
            )}
        </div>
    );
}

function CopyButton({
    text,
    label,
    copiedLabel,
}: {
    text: string;
    label: string;
    copiedLabel: string;
}) {
    const { copied, copy } = useCopyText();
    const tooltip = copied ? copiedLabel : label;

    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        aria-label={tooltip}
                        onClick={() => copy(text)}
                    >
                        <span className="grid size-3.5" aria-hidden="true">
                            <CopyIcon
                                className="swap-layer [grid-area:1/1]"
                                data-on={!copied}
                            />
                            <CheckIcon
                                className="swap-layer [grid-area:1/1]"
                                data-on={copied}
                            />
                        </span>
                    </Button>
                }
            />
            <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
    );
}

function toText(value: unknown): string {
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            try {
                return JSON.stringify(JSON.parse(trimmed), null, 2);
            } catch {
                return value;
            }
        }
        return value;
    }
    return JSON.stringify(value, null, 2);
}
