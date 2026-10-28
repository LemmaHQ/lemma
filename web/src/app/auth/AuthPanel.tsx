import type { ReactNode } from "react";
import { Link } from "react-router";

function followHeight(content: HTMLDivElement) {
    const observer = new ResizeObserver(() => {
        content.parentElement?.style.setProperty(
            "--auth-panel-height",
            `${content.offsetHeight}px`,
        );
    });
    observer.observe(content);
    return () => {
        observer.disconnect();
    };
}

/** Title, description, form, and the link to the other auth page; height changes animate. */
export function AuthPanel({
    title,
    description,
    switchPrompt,
    switchLabel,
    switchTo,
    children,
}: {
    title: string;
    description: string;
    switchPrompt: string;
    switchLabel: string;
    switchTo: string;
    children: ReactNode;
}) {
    return (
        <div className="-m-1 h-(--auth-panel-height) overflow-hidden transition-all duration-slow ease-move motion-reduce:transition-none">
            <div ref={followHeight} className="flex flex-col gap-6 p-1">
                <div className="flex flex-col gap-1.5 text-center">
                    <h1 className="text-xl font-semibold">{title}</h1>
                    <p className="text-sm text-muted-foreground">
                        {description}
                    </p>
                </div>
                {children}
                <p className="text-center text-sm text-muted-foreground">
                    {switchPrompt}{" "}
                    <Link
                        to={switchTo}
                        viewTransition
                        className="font-medium text-foreground underline underline-offset-4"
                    >
                        {switchLabel}
                    </Link>
                </p>
            </div>
        </div>
    );
}
