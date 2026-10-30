import { Toaster as Sonner, type ToasterProps } from "sonner";

import { CircleAlertIcon } from "#icons/circle-alert";
import { CircleCheckIcon } from "#icons/circle-check";
import { InfoIcon } from "#icons/info";
import { LoaderCircleIcon } from "#icons/loader-circle";
import { TriangleAlertIcon } from "#icons/triangle-alert";

/** Toast host at the top center; the app passes the resolved `theme`. */
function Toaster(props: ToasterProps) {
    return (
        <Sonner
            position="top-center"
            icons={{
                success: <CircleCheckIcon className="size-4" />,
                info: <InfoIcon className="size-4" />,
                warning: <TriangleAlertIcon className="size-4" />,
                error: <CircleAlertIcon className="size-4 text-destructive" />,
                loading: <LoaderCircleIcon animate className="size-4" />,
            }}
            style={{
                "--normal-bg": "var(--popover)",
                "--normal-text": "var(--popover-foreground)",
                "--normal-border": "var(--border)",
                "--border-radius": "var(--radius)",
            }}
            toastOptions={{
                classNames: {
                    toast: "inset-x-0! mx-auto! w-fit! max-w-full! justify-center py-2.5! text-center font-sans text-base!",
                    content: "flex-none!",
                },
            }}
            {...props}
        />
    );
}

export { Toaster };
