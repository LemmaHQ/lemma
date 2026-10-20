import { IconCornerDownLeft, IconSquare } from "@tabler/icons-react";
import { cn } from "cn";
import {
    Children,
    type ComponentProps,
    type KeyboardEvent,
    useState,
} from "react";

import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupTextarea,
} from "@/components/ui/input-group";

type PromptInputProps = Omit<ComponentProps<"form">, "onSubmit"> & {
    onSubmit: () => void;
};

export function PromptInput({
    className,
    onSubmit,
    children,
    ...props
}: PromptInputProps) {
    return (
        <form
            className={cn("w-full", className)}
            onSubmit={(event) => {
                event.preventDefault();
                onSubmit();
            }}
            {...props}
        >
            <InputGroup className="overflow-hidden">{children}</InputGroup>
        </form>
    );
}

export function PromptInputBody({
    className,
    ...props
}: ComponentProps<"div">) {
    return <div className={cn("contents", className)} {...props} />;
}

/**
 * Message field. Enter submits the form unless its submit button is disabled;
 * Shift+Enter inserts a newline, and Enter that confirms an IME composition
 * submits nothing.
 */
export function PromptInputTextarea({
    className,
    ...props
}: ComponentProps<typeof InputGroupTextarea>) {
    const [isComposing, setIsComposing] = useState(false);

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (
            event.key !== "Enter" ||
            event.shiftKey ||
            isComposing ||
            event.nativeEvent.isComposing
        ) {
            return;
        }
        event.preventDefault();
        const { form } = event.currentTarget;
        const submitButton = form?.querySelector<HTMLButtonElement>(
            'button[type="submit"]',
        );
        if (form === null || submitButton?.disabled === true) {
            return;
        }
        form.requestSubmit();
    };

    return (
        <InputGroupTextarea
            className={cn("field-sizing-content max-h-48 min-h-16", className)}
            name="message"
            onCompositionEnd={() => setIsComposing(false)}
            onCompositionStart={() => setIsComposing(true)}
            onKeyDown={handleKeyDown}
            {...props}
        />
    );
}

export function PromptInputFooter({
    className,
    ...props
}: Omit<ComponentProps<typeof InputGroupAddon>, "align">) {
    return (
        <InputGroupAddon
            align="block-end"
            className={cn("justify-between gap-1", className)}
            {...props}
        />
    );
}

export function PromptInputTools({
    className,
    ...props
}: ComponentProps<"div">) {
    return (
        <div className={cn("flex items-center gap-1", className)} {...props} />
    );
}

export function PromptInputButton({
    variant = "ghost",
    size,
    ...props
}: ComponentProps<typeof InputGroupButton>) {
    return (
        <InputGroupButton
            size={
                size ?? (Children.count(props.children) > 1 ? "sm" : "icon-sm")
            }
            type="button"
            variant={variant}
            {...props}
        />
    );
}

type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
    status?: "ready" | "streaming";
};

export function PromptInputSubmit({
    variant = "default",
    size = "icon-sm",
    status = "ready",
    children,
    ...props
}: PromptInputSubmitProps) {
    return (
        <InputGroupButton
            size={size}
            type="submit"
            variant={variant}
            {...props}
        >
            {children ??
                (status === "streaming" ? (
                    <IconSquare className="size-4" />
                ) : (
                    <IconCornerDownLeft className="size-4" />
                ))}
        </InputGroupButton>
    );
}
