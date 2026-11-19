import { code as codePlugin } from "@streamdown/code";
import { useContext, useMemo, type ReactNode } from "react";
import {
    CodeBlock as StreamdownCodeBlock,
    StreamdownContext,
} from "streamdown";

/** A highlighted, line-numbered code block outside Markdown, with `actions` in its header. */
export function CodeBlock({
    code,
    language,
    actions,
}: {
    code: string;
    language: string;
    actions: ReactNode;
}) {
    const baseContext = useContext(StreamdownContext);
    const context = useMemo(
        () => ({
            ...baseContext,
            plugins: { code: codePlugin },
            controls: false,
            lineNumbers: true,
        }),
        [baseContext],
    );

    return (
        <div data-slot="code-block">
            <StreamdownContext value={context}>
                <StreamdownCodeBlock
                    code={code}
                    language={language}
                    lineNumbers
                >
                    {actions}
                </StreamdownCodeBlock>
            </StreamdownContext>
        </div>
    );
}
