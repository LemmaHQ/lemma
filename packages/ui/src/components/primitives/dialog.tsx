import { AnimateIcon } from "@animate-ui/react/icons";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "#lib/cn";
import * as React from "react";

import { Button } from "#primitives/button";
import { XIcon } from "#icons/x";

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
    return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
    return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
    return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
    return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
    className,
    ...props
}: DialogPrimitive.Backdrop.Props) {
    return (
        <DialogPrimitive.Backdrop
            data-slot="dialog-overlay"
            className={cn(
                "fixed inset-0 isolate z-50 bg-scrim duration-medium ease-enter data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:duration-base data-closed:ease-exit data-closed:fade-out-0",
                className,
            )}
            {...props}
        />
    );
}

/** `closeLabel` names the corner close button; without it the dialog has none. */
function DialogContent({
    className,
    children,
    closeLabel,
    size = "default",
    ...props
}: DialogPrimitive.Popup.Props & {
    closeLabel?: string;
    size?: "default" | "lg";
}) {
    return (
        <DialogPortal>
            <DialogOverlay />
            <DialogPrimitive.Popup
                data-slot="dialog-content"
                data-size={size}
                className={cn(
                    "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-popover p-4 text-body text-popover-foreground shadow-modal duration-medium ease-enter outline-none sm:data-[size=default]:max-w-100 sm:data-[size=lg]:max-w-120 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:duration-base data-closed:ease-exit data-closed:fade-out-0 data-closed:zoom-out-95",
                    className,
                )}
                {...props}
            >
                {children}
                {closeLabel !== undefined && (
                    <AnimateIcon animateOnHover asChild>
                        <DialogPrimitive.Close
                            data-slot="dialog-close"
                            render={
                                <Button
                                    variant="ghost"
                                    className="absolute top-2 right-2"
                                    size="icon-sm"
                                    aria-label={closeLabel}
                                />
                            }
                        >
                            <XIcon />
                        </DialogPrimitive.Close>
                    </AnimateIcon>
                )}
            </DialogPrimitive.Popup>
        </DialogPortal>
    );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="dialog-header"
            className={cn("flex flex-col gap-2", className)}
            {...props}
        />
    );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="dialog-footer"
            className={cn(
                "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
                className,
            )}
            {...props}
        />
    );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
    return (
        <DialogPrimitive.Title
            data-slot="dialog-title"
            className={cn("text-title", className)}
            {...props}
        />
    );
}

function DialogDescription({
    className,
    ...props
}: DialogPrimitive.Description.Props) {
    return (
        <DialogPrimitive.Description
            data-slot="dialog-description"
            className={cn(
                "text-small text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
                className,
            )}
            {...props}
        />
    );
}

export {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
    DialogTrigger,
};
