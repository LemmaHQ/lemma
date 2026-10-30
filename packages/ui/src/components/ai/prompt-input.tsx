import { cn } from "cn";
import { CornerDownLeftIcon, SquareIcon } from "lucide-react";
import {
    Children,
    type ComponentProps,
    type KeyboardEvent,
    useCallback,
    useLayoutEffect,
    useRef,
    useState,
} from "react";

import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupTextarea,
} from "#primitives/input-group";

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
    ref,
    value,
    onChange,
    onCompositionEnd,
    onCompositionStart,
    onKeyDown,
    ...props
}: ComponentProps<typeof InputGroupTextarea>) {
    const [isComposing, setIsComposing] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const setTextareaRef = useCallback(
        (textarea: HTMLTextAreaElement | null) => {
            textareaRef.current = textarea;
            if (typeof ref === "function") {
                ref(textarea);
            } else if (ref !== undefined && ref !== null) {
                ref.current = textarea;
            }
        },
        [ref],
    );

    useLayoutEffect(() => {
        const textarea = textareaRef.current;
        if (
            textarea !== null &&
            (value === undefined || textarea.value === String(value))
        ) {
            resizeTextarea(textarea);
        }
    }, [value]);

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        onKeyDown?.(event);
        if (
            event.defaultPrevented ||
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
            ref={setTextareaRef}
            className={cn(
                "box-border h-(--prompt-input-height,auto) max-h-48 min-h-16 overflow-y-auto transition-[height] duration-slow ease-morph motion-reduce:transition-none",
                className,
            )}
            name="message"
            value={value}
            onChange={(event) => {
                onChange?.(event);
                resizeTextarea(event.currentTarget);
            }}
            onCompositionEnd={(event) => {
                setIsComposing(false);
                onCompositionEnd?.(event);
            }}
            onCompositionStart={(event) => {
                setIsComposing(true);
                onCompositionStart?.(event);
            }}
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
    className,
    variant = "ghost",
    size,
    ...props
}: ComponentProps<typeof InputGroupButton>) {
    return (
        <InputGroupButton
            className={cn("press-scale active:translate-y-0", className)}
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
    className,
    variant = "default",
    size = "icon-sm",
    status = "ready",
    children,
    ...props
}: PromptInputSubmitProps) {
    return (
        <InputGroupButton
            className={cn(
                "press-scale active:translate-y-0 [--press-scale:0.94]",
                className,
            )}
            size={size}
            type="submit"
            variant={variant}
            {...props}
        >
            {children ?? (
                <span className="grid size-4 place-items-center">
                    <span
                        className="swap-turn flex items-center justify-center [grid-area:1/1]"
                        data-on={status !== "streaming"}
                    >
                        <CornerDownLeftIcon className="size-4" />
                    </span>
                    <span
                        className="swap-turn flex items-center justify-center [grid-area:1/1]"
                        data-on={status === "streaming"}
                    >
                        <SquareIcon className="size-4" />
                    </span>
                </span>
            )}
        </InputGroupButton>
    );
}

function resizeTextarea(textarea: HTMLTextAreaElement) {
    textarea.style.setProperty("--prompt-input-height", "auto");
    const height = Math.min(192, Math.max(64, textarea.scrollHeight));
    textarea.style.setProperty("--prompt-input-height", `${height}px`);
}
