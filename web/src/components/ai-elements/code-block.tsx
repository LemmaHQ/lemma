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
    const [html, setHtml] = useState({ light: "", dark: "" });

    useEffect(() => {
        let current = true;
        const highlight = async () => {
            const [light, dark] = await Promise.all([
                codeToHtml(code, { lang: language, theme: "one-light" }),
                codeToHtml(code, { lang: language, theme: "one-dark-pro" }),
            ]);
            if (current) {
                setHtml({ light, dark });
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
                className="overflow-auto dark:hidden [&_code]:font-mono [&_code]:text-sm [&>pre]:m-0 [&>pre]:bg-background! [&>pre]:p-4 [&>pre]:text-sm [&>pre]:text-foreground!"
                dangerouslySetInnerHTML={{ __html: html.light }}
            />
            <div
                className="hidden overflow-auto dark:block [&_code]:font-mono [&_code]:text-sm [&>pre]:m-0 [&>pre]:bg-background! [&>pre]:p-4 [&>pre]:text-sm [&>pre]:text-foreground!"
                dangerouslySetInnerHTML={{ __html: html.dark }}
            />
        </div>
    );
}
