import type { ReactNode } from "react";
import { Link } from "react-router";

/** Title, description, form, and the link to the other auth page. */
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
        <div className="flex flex-col gap-6 auth-transition-panel view-transition-morph">
            <div className="flex flex-col gap-1.5 text-center">
                <h1 className="text-xl font-semibold">{title}</h1>
                <p className="text-sm text-muted-foreground">{description}</p>
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
    );
}
