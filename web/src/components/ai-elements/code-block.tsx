import { cn } from "cn";
import { type ComponentProps, useEffect, useState } from "react";
import { type BundledLanguage, codeToHtml } from "shiki";

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
