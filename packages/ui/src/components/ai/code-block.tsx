import { cn } from "cn";
import {
    type CSSProperties,
    type ComponentProps,
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { type BundledLanguage, codeToHtml } from "shiki";

import { Tooltip, TooltipContent, TooltipTrigger } from "#primitives/tooltip";
import { useCopyText } from "#hooks/use-copy-text";
import { CheckIcon } from "#icons/check";
import { CopyIcon } from "#icons/copy";

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
        const highlight = async () => {
            const highlighted = await codeToHtml(code, {
                lang: language,
                themes: { light: "one-light", dark: "one-dark-pro" },
                defaultColor: "light-dark()",
            });
            if (current) {
                setHtml(highlighted);
            }
        };
        void highlight();
        return () => {
            current = false;
        };
    }, [code, language]);

    return (
        <div
            className={cn(
                "relative w-full overflow-hidden rounded-md border bg-background text-foreground",
                className,
            )}
            {...props}
        >
            <div
                className="overflow-auto [&_code]:font-mono [&_code]:text-sm [&>pre]:m-0 [&>pre]:bg-background! [&>pre]:p-4 [&>pre]:text-sm [&>pre]:text-foreground!"
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
    const codeRef = useRef<HTMLDivElement>(null);
    const [full, setFull] = useState(false);
    const [height, setHeight] = useState(0);
    const text = toText(value);

    useLayoutEffect(() => {
        const element = codeRef.current;
        if (element === null) {
            return;
        }
        const measure = () => setHeight(element.scrollHeight);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        const content = element.firstElementChild;
        if (content !== null) {
            observer.observe(content);
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
                <span className="text-xs font-medium text-muted-foreground">
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
                ref={codeRef}
                className="relative max-h-(--tool-call-code-height) overflow-hidden rounded-md transition-[max-height] duration-reveal ease-enter after:pointer-events-none after:absolute after:inset-x-px after:bottom-px after:h-14 after:rounded-b-sm after:bg-linear-to-b after:from-transparent after:to-background after:opacity-0 after:transition-opacity after:duration-medium after:ease-enter after:content-[''] data-[capped=true]:after:opacity-100 motion-reduce:transition-none motion-reduce:after:transition-none"
                data-capped={capped && !full}
                style={style}
            >
                <CodeBlock code={text} language="json" />
            </div>
            {capped && (
                <button
                    type="button"
                    className="cursor-pointer justify-self-start rounded-sm text-xs font-medium text-muted-foreground transition-colors duration-base hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                    aria-controls={id}
                    aria-expanded={full}
                    onClick={() => setFull(!full)}
                >
                    {full ? labels.showLess : labels.showAll}
                </button>
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
                    <button
                        type="button"
                        className="relative grid size-6 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors duration-base hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                        aria-label={tooltip}
                        onClick={() => copy(text)}
                    />
                }
            >
                <CopyIcon
                    className="swap-layer absolute size-3.5"
                    data-on={!copied}
                />
                <CheckIcon
                    className="swap-layer absolute size-3.5"
                    data-on={copied}
                />
            </TooltipTrigger>
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
