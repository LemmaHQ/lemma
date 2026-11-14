import {
    type ComponentProps,
    createContext,
    isValidElement,
    type ReactNode,
    useContext,
    useMemo,
} from "react";
import {
    CodeBlock as StreamdownCodeBlock,
    CodeBlockCopyButton,
    CodeBlockDownloadButton,
    defaultComponents,
    StreamdownContext,
    useIsCodeFenceIncomplete,
} from "streamdown";

const LANGUAGE_RE = /language-([^\s]+)/u;
const START_LINE_RE = /startLine=(\d+)/u;
const NO_LINE_NUMBERS_RE = /\bnoLineNumbers\b/u;

export type CodeComponentProps = ComponentProps<typeof defaultComponents.code>;

type MessageCodeContextValue = {
    openCodeLabel?: string | undefined;
    onOpenCode?: ((code: string, language: string) => void) | undefined;
};

const MessageCodeContext = createContext<MessageCodeContextValue>({});

/** Provides open-code action callbacks to `MessageCodeBlock` without creating unstable render components. */
export function MessageCodeProvider({
    openCodeLabel,
    onOpenCode,
    children,
}: MessageCodeContextValue & { children: ReactNode }) {
    const value = useMemo(
        () => ({ openCodeLabel, onOpenCode }),
        [openCodeLabel, onOpenCode],
    );
    return (
        <MessageCodeContext.Provider value={value}>
            {children}
        </MessageCodeContext.Provider>
    );
}

/** Streamdown code block renderer adding an action button to open code in the detail pane. */
export function MessageCodeBlock({
    node,
    className,
    children,
    openCodeLabel: propOpenCodeLabel,
    onOpenCode: propOnOpenCode,
    ...rest
}: CodeComponentProps & MessageCodeContextValue) {
    const { controls, lineNumbers } = useContext(StreamdownContext);
    const codeContext = useContext(MessageCodeContext);
    const isIncomplete = useIsCodeFenceIncomplete();
    const isBlock = "data-block" in rest;
    const language = className?.match(LANGUAGE_RE)?.at(1) ?? "";
    const openCodeLabel = propOpenCodeLabel ?? codeContext.openCodeLabel;
    const onOpenCode = propOnOpenCode ?? codeContext.onOpenCode;

    if (
        !isBlock ||
        language === "mermaid" ||
        openCodeLabel === undefined ||
        onOpenCode === undefined
    ) {
        const DefaultCode = defaultComponents.code;
        return (
            <DefaultCode node={node} className={className} {...rest}>
                {children}
            </DefaultCode>
        );
    }

    let codeText = "";
    if (
        isValidElement<{ children?: unknown }>(children) &&
        typeof children.props.children === "string"
    ) {
        codeText = children.props.children;
    } else if (typeof children === "string") {
        codeText = children;
    }

    const metastring =
        typeof node?.properties.metastring === "string"
            ? node.properties.metastring
            : "";
    const startLineMatch = START_LINE_RE.exec(metastring);
    const parsedStartLine =
        startLineMatch?.[1] === undefined
            ? undefined
            : Math.trunc(Number(startLineMatch[1]));
    const startLine =
        parsedStartLine !== undefined && parsedStartLine >= 1
            ? parsedStartLine
            : undefined;
    const showLineNumbers = !NO_LINE_NUMBERS_RE.test(metastring) && lineNumbers;
    const codeControl =
        typeof controls === "object" && typeof controls.code === "object"
            ? controls.code
            : undefined;
    const showControls =
        controls !== false &&
        (typeof controls !== "object" || controls.code !== false);

    return (
        <StreamdownCodeBlock
            code={codeText}
            isIncomplete={isIncomplete}
            language={language}
            lineNumbers={showLineNumbers}
            {...(className === undefined ? {} : { className })}
            {...(startLine === undefined ? {} : { startLine })}
        >
            {showControls && codeControl?.download !== false && (
                <CodeBlockDownloadButton code={codeText} language={language} />
            )}
            {showControls && codeControl?.copy !== false && (
                <CodeBlockCopyButton />
            )}
            <button
                type="button"
                aria-label={openCodeLabel}
                onClick={() => onOpenCode(codeText, language)}
                className="cursor-pointer rounded-sm px-1.5 py-0.5 text-caption font-medium text-muted-foreground transition-colors duration-base hover:text-foreground"
            >
                {openCodeLabel}
            </button>
        </StreamdownCodeBlock>
    );
}
