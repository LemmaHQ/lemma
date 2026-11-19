import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { cn } from "#lib/cn";
import {
    type ComponentProps,
    createContext,
    memo,
    type ReactNode,
    useContext,
} from "react";
import {
    CodeBlock as StreamdownCodeBlock,
    CodeBlockCopyButton,
    defaultComponents,
    Streamdown,
    StreamdownContext,
    useIsCodeFenceIncomplete,
} from "streamdown";

type CodeActions = (block: { code: string; language: string }) => ReactNode;

const PLUGINS = { code, cjk };
const STREAMING_ANIMATION = {
    animation: "answerBlurIn",
    duration: 400,
    easing: "var(--motion-easing-enter)",
} as const;
const CONTROLS = { table: false, code: { copy: true, download: false } };
const LANGUAGE_RE = /language-([^\s]+)/u;
const START_LINE_RE = /startLine=(\d+)/u;
const NO_LINE_NUMBERS_RE = /\bnoLineNumbers\b/u;

const CodeActionsContext = createContext<CodeActions | undefined>(undefined);

function MarkdownCode({
    node,
    className,
    children,
    ...rest
}: ComponentProps<typeof defaultComponents.code>) {
    const codeActions = useContext(CodeActionsContext);
    const { lineNumbers } = useContext(StreamdownContext);
    const isIncomplete = useIsCodeFenceIncomplete();
    const language = className?.match(LANGUAGE_RE)?.at(1) ?? "";

    if (
        !("data-block" in rest) ||
        language === "mermaid" ||
        codeActions === undefined
    ) {
        const DefaultCode = defaultComponents.code;
        return (
            <DefaultCode node={node} className={className} {...rest}>
                {children}
            </DefaultCode>
        );
    }

    const text = typeof children === "string" ? children : "";
    const metastring =
        typeof node?.properties.metastring === "string"
            ? node.properties.metastring
            : "";
    const startLine = Number(START_LINE_RE.exec(metastring)?.[1] ?? 0);

    return (
        <StreamdownCodeBlock
            code={text}
            isIncomplete={isIncomplete}
            language={language}
            lineNumbers={lineNumbers && !NO_LINE_NUMBERS_RE.test(metastring)}
            {...(className === undefined ? {} : { className })}
            {...(startLine >= 1 ? { startLine } : {})}
        >
            <CodeBlockCopyButton />
            {codeActions({ code: text, language })}
        </StreamdownCodeBlock>
    );
}

const COMPONENTS = { code: MarkdownCode };

/**
 * Markdown in the reading type role with highlighted code and CJK-aware emphasis.
 * While `streaming`, new text fades in behind a pulsing caret. `endMark` follows the last paragraph on its line,
 * and `renderCodeActions` adds controls beside the copy button of each fenced code block.
 */
export const Markdown = memo(function Markdown({
    children,
    streaming = false,
    endMark,
    renderCodeActions,
}: {
    children: string;
    streaming?: boolean | undefined;
    endMark?: ReactNode;
    renderCodeActions?: CodeActions | undefined;
}) {
    const body = (
        <Streamdown
            className={cn(
                "markdown [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
                endMark === undefined
                    ? "size-full"
                    : "[&>p:last-child]:inline has-[>p:last-child]:inline",
            )}
            animated={streaming ? STREAMING_ANIMATION : false}
            caret="circle"
            controls={CONTROLS}
            isAnimating={streaming}
            plugins={PLUGINS}
            components={COMPONENTS}
        >
            {children}
        </Streamdown>
    );

    return (
        <CodeActionsContext value={renderCodeActions}>
            {endMark === undefined ? (
                body
            ) : (
                <div className="inline">
                    {body}
                    <span className="whitespace-nowrap">{endMark}</span>
                </div>
            )}
        </CodeActionsContext>
    );
});
