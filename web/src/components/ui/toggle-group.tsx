import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { cn } from "cn";
import * as React from "react";

import { Toggle } from "@/components/ui/toggle";

type ToggleStyle = Pick<
    React.ComponentProps<typeof Toggle>,
    "variant" | "size"
>;

type ToggleGroupStyle = ToggleStyle & {
    spacing?: number;
    orientation?: "horizontal" | "vertical";
};

const ToggleGroupContext = React.createContext<ToggleGroupStyle>({
    size: "default",
    variant: "default",
    spacing: 2,
    orientation: "horizontal",
});

function ToggleGroup({
    className,
    variant,
    size,
    spacing = 2,
    orientation = "horizontal",
    children,
    ...props
}: ToggleGroupPrimitive.Props & ToggleGroupStyle) {
    const style = React.useMemo(
        () => ({ variant, size, spacing, orientation }),
        [variant, size, spacing, orientation],
    );
    return (
        <ToggleGroupPrimitive
            data-slot="toggle-group"
            data-variant={variant}
            data-size={size}
            data-spacing={spacing}
            data-orientation={orientation}
            style={{ "--gap": spacing }}
            className={cn(
                "group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] rounded-lg data-[size=sm]:rounded-[min(var(--radius-md),10px)] data-vertical:flex-col data-vertical:items-stretch",
                className,
            )}
            {...props}
        >
            <ToggleGroupContext value={style}>{children}</ToggleGroupContext>
        </ToggleGroupPrimitive>
    );
}

function ToggleGroupItem({
    className,
    variant = "default",
    size = "default",
    ...props
}: React.ComponentProps<typeof Toggle>) {
    const context = React.useContext(ToggleGroupContext);
    const itemVariant = context.variant ?? variant;
    const itemSize = context.size ?? size;

    return (
        <Toggle
            data-slot="toggle-group-item"
            data-variant={itemVariant}
            data-size={itemSize}
            data-spacing={context.spacing}
            variant={itemVariant}
            size={itemSize}
            className={cn(
                "shrink-0 group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:px-2 focus:z-10 focus-visible:z-10 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-end]:pr-1.5 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-start]:pl-1.5 group-data-horizontal/toggle-group:data-[spacing=0]:first:rounded-l-lg group-data-vertical/toggle-group:data-[spacing=0]:first:rounded-t-lg group-data-horizontal/toggle-group:data-[spacing=0]:last:rounded-r-lg group-data-vertical/toggle-group:data-[spacing=0]:last:rounded-b-lg group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:border-l-0 group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-l group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t",
                className,
            )}
            {...props}
        />
    );
}

export { ToggleGroup, ToggleGroupItem };
