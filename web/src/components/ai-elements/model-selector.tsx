import { cn } from "cn";
import type { ComponentProps, ReactNode } from "react";

import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

export function ModelSelector(props: ComponentProps<typeof Dialog>) {
    return <Dialog {...props} />;
}

export function ModelSelectorTrigger(
    props: ComponentProps<typeof DialogTrigger>,
) {
    return <DialogTrigger {...props} />;
}

type ModelSelectorContentProps = ComponentProps<typeof DialogContent> & {
    title: ReactNode;
};

export function ModelSelectorContent({
    className,
    children,
    title,
    ...props
}: ModelSelectorContentProps) {
    return (
        <DialogContent className={cn("p-0", className)} {...props}>
            <DialogTitle className="sr-only">{title}</DialogTitle>
            <Command className="**:data-[slot=command-input-wrapper]:h-auto">
                {children}
            </Command>
        </DialogContent>
    );
}

export function ModelSelectorInput({
    className,
    ...props
}: ComponentProps<typeof CommandInput>) {
    return (
        <CommandInput className={cn("h-auto py-3.5", className)} {...props} />
    );
}

export function ModelSelectorList(props: ComponentProps<typeof CommandList>) {
    return <CommandList {...props} />;
}

export function ModelSelectorEmpty(props: ComponentProps<typeof CommandEmpty>) {
    return <CommandEmpty {...props} />;
}

export function ModelSelectorGroup(props: ComponentProps<typeof CommandGroup>) {
    return <CommandGroup {...props} />;
}

export function ModelSelectorItem(props: ComponentProps<typeof CommandItem>) {
    return <CommandItem {...props} />;
}

export function ModelSelectorName({
    className,
    ...props
}: ComponentProps<"span">) {
    return (
        <span
            className={cn("flex-1 truncate text-left", className)}
            {...props}
        />
    );
}
