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
import { useTranslation } from "react-i18next";
import { type BundledLanguage, codeToHtml } from "shiki";

import { Tooltip, TooltipContent, TooltipTrigger } from "#components/tooltip";
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

type CodeBlockSectionProps = {
    label: string;
    copyLabel: string;
    value: unknown;
    cap: number;
};

export function CodeBlockSection({
    label,
    copyLabel,
    value,
    cap,
}: CodeBlockSectionProps) {
    const { t } = useTranslation("ui");
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
                <CopyButton label={copyLabel} text={text} />
            </div>
            <div
                id={id}
                ref={codeRef}
                className="tool-call-code-shell"
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
                    {full
                        ? t("agent.toolCall.showLess")
                        : t("agent.toolCall.showAll")}
                </button>
            )}
        </div>
    );
}

function CopyButton({ text, label }: { text: string; label: string }) {
    const { t } = useTranslation("ui");
    const [copied, setCopied] = useState(false);
    const tooltip = copied ? t("agent.toolCall.copied") : label;

    useEffect(() => {
        if (!copied) {
            return;
        }
        const timer = window.setTimeout(() => setCopied(false), 1400);
        return () => window.clearTimeout(timer);
    }, [copied]);

    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <button
                        type="button"
                        className="tool-call-copy relative grid size-6 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors duration-base hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                        data-copied={copied}
                        aria-label={tooltip}
                        onClick={() => {
                            void navigator.clipboard
                                .writeText(text)
                                .then(() => setCopied(true))
                                .catch(() => {});
                        }}
                    />
                }
            >
                <CopyIcon className="tool-call-copy-icon absolute size-3.5" />
                <CheckIcon className="tool-call-copy-done absolute size-3.5" />
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
