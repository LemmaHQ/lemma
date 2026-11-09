import { AnimateIcon } from "@animate-ui/react/icons";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { cn } from "#lib/cn";
import * as React from "react";

import { Button } from "#primitives/button";
import { XIcon } from "#icons/x";

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
    return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
    return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
    return (
        <SheetPrimitive.Backdrop
            data-slot="sheet-overlay"
            className={cn(
                "fixed inset-0 z-50 bg-scrim transition-opacity duration-slow ease-enter data-ending-style:opacity-0 data-ending-style:duration-medium data-ending-style:ease-exit data-starting-style:opacity-0",
                className,
            )}
            {...props}
        />
    );
}

/** `closeLabel` names the corner close button; without it the sheet has none. */
function SheetContent({
    className,
    children,
    side = "right",
    closeLabel,
    ...props
}: SheetPrimitive.Popup.Props & {
    side?: "top" | "right" | "bottom" | "left";
    closeLabel?: string;
}) {
    return (
        <SheetPortal>
            <SheetOverlay />
            <SheetPrimitive.Popup
                data-slot="sheet-content"
                data-side={side}
                className={cn(
                    "fixed z-50 flex flex-col gap-4 border bg-popover bg-clip-padding text-body text-popover-foreground shadow-modal transition duration-slow ease-enter data-ending-style:opacity-0 data-ending-style:duration-medium data-ending-style:ease-exit data-starting-style:opacity-0 data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:rounded-t-lg data-[side=bottom]:data-ending-style:translate-y-10 data-[side=bottom]:data-starting-style:translate-y-10 data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:rounded-r-lg data-[side=left]:data-ending-style:-translate-x-10 data-[side=left]:data-starting-style:-translate-x-10 data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:rounded-l-lg data-[side=right]:data-ending-style:translate-x-10 data-[side=right]:data-starting-style:translate-x-10 data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:rounded-b-lg data-[side=top]:data-ending-style:-translate-y-10 data-[side=top]:data-starting-style:-translate-y-10 motion-reduce:transition-opacity sm:data-[side=left]:max-w-sm sm:data-[side=right]:max-w-sm",
                    className,
                )}
                {...props}
            >
                {children}
                {closeLabel !== undefined && (
                    <AnimateIcon animateOnHover asChild>
                        <SheetPrimitive.Close
                            data-slot="sheet-close"
                            render={
                                <Button
                                    variant="ghost"
                                    className="absolute top-3 right-3"
                                    size="icon-sm"
                                    aria-label={closeLabel}
                                />
                            }
                        >
                            <XIcon />
                        </SheetPrimitive.Close>
                    </AnimateIcon>
                )}
            </SheetPrimitive.Popup>
        </SheetPortal>
    );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="sheet-header"
            className={cn("flex flex-col gap-0.5 p-4", className)}
            {...props}
        />
    );
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
    return (
        <SheetPrimitive.Title
            data-slot="sheet-title"
            className={cn("text-title text-foreground", className)}
            {...props}
        />
    );
}

export { Sheet, SheetContent, SheetHeader, SheetTitle };
