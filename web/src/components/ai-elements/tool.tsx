import {
    IconChevronDown,
    IconCircleCheck,
    IconCircleX,
    IconClock,
    IconTool,
} from "@tabler/icons-react";
import { cn } from "cn";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { CodeBlock } from "./code-block";
import { Shimmer } from "./shimmer";

type ToolState = "input-available" | "output-available" | "output-error";

const PANEL_MOTION =
    "h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-medium ease-move data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none";

const STATUS = {
    "input-available": {
        icon: IconClock,
        iconClassName: "animate-pulse",
        label: "chat.toolCall.running",
    },
    "output-available": {
        icon: IconCircleCheck,
        iconClassName: "",
        label: "chat.toolCall.done",
    },
    "output-error": {
        icon: IconCircleX,
        iconClassName: "text-destructive",
        label: "chat.toolCall.failed",
    },
} as const satisfies Record<ToolState, unknown>;

export function ToolGroup({
    className,
    ...props
}: ComponentProps<typeof Collapsible>) {
    return <Collapsible className={cn("w-full", className)} {...props} />;
}

type ToolGroupTriggerProps = Omit<
    ComponentProps<typeof CollapsibleTrigger>,
    "children"
> & {
    count: number;
    failed: number;
    running: boolean;
};

export function ToolGroupTrigger({
    className,
    count,
    failed,
    running,
    ...props
}: ToolGroupTriggerProps) {
    const { t } = useTranslation();
    return (
        <CollapsibleTrigger
            className={cn(
                "flex w-full items-center gap-2 text-sm text-muted-foreground transition-colors duration-fast hover:text-foreground",
                className,
            )}
            {...props}
        >
            <IconTool className="size-4" />
            {running ? (
                <Shimmer>{t("chat.toolGroup.running", { count })}</Shimmer>
            ) : (
                <span>{t("chat.toolGroup.used", { count })}</span>
            )}
            {failed > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                    <IconCircleX className="size-4" />
                    {t("chat.toolGroup.failed", { count: failed })}
                </span>
            )}
            <IconChevronDown className="size-4 transition-transform duration-medium ease-move in-data-panel-open:rotate-180 motion-reduce:transition-none" />
        </CollapsibleTrigger>
    );
}

export function ToolGroupContent({
    className,
    children,
    ...props
}: ComponentProps<typeof CollapsibleContent>) {
    return (
        <CollapsibleContent
            className={cn(PANEL_MOTION, "outline-none", className)}
            {...props}
        >
            <div className="mt-3 flex flex-col gap-2 border-l-2 border-muted pl-4">
                {children}
            </div>
        </CollapsibleContent>
    );
}

export function Tool({
    className,
    ...props
}: ComponentProps<typeof Collapsible>) {
    return (
        <Collapsible
            className={cn("w-full rounded-md border", className)}
            {...props}
        />
    );
}

type ToolHeaderProps = {
    title: string;
    state: ToolState;
    className?: string;
};

export function ToolHeader({ className, title, state }: ToolHeaderProps) {
    const { t } = useTranslation();
    const status = STATUS[state];
    const StatusIcon = status.icon;
    return (
        <CollapsibleTrigger
            className={cn(
                "flex w-full items-center justify-between gap-4 p-3",
                className,
            )}
        >
            <div className="flex items-center gap-2">
                <IconTool className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">{title}</span>
                <Badge
                    className="gap-1.5 rounded-full text-xs"
                    variant="secondary"
                >
                    <StatusIcon
                        className={cn("size-4", status.iconClassName)}
                    />
                    {t(status.label)}
                </Badge>
            </div>
            <IconChevronDown className="size-4 text-muted-foreground transition-transform duration-medium ease-move in-data-panel-open:rotate-180 motion-reduce:transition-none" />
        </CollapsibleTrigger>
    );
}

export function ToolContent({
    className,
    ...props
}: ComponentProps<typeof CollapsibleContent>) {
    return (
        <CollapsibleContent
            className={cn(
                PANEL_MOTION,
                "text-popover-foreground outline-none",
                className,
            )}
            {...props}
        />
    );
}

type ToolInputProps = ComponentProps<"div"> & {
    input: unknown;
};

export function ToolInput({ className, input, ...props }: ToolInputProps) {
    const { t } = useTranslation();
    return (
        <div
            className={cn("space-y-2 overflow-hidden p-4", className)}
            {...props}
        >
            <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t("chat.toolCall.arguments")}
            </h4>
            <div className="rounded-md bg-muted/50">
                <CodeBlock
                    code={JSON.stringify(input, null, 2)}
                    language="json"
                />
            </div>
        </div>
    );
}

type ToolOutputProps = ComponentProps<"div"> & {
    output?: string | undefined;
    errorText?: string | undefined;
};

export function ToolOutput({
    className,
    output,
    errorText,
    ...props
}: ToolOutputProps) {
    const { t } = useTranslation();
    if (errorText !== undefined && errorText !== "") {
        return (
            <div className={cn("space-y-2 p-4", className)} {...props}>
                <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {t("chat.toolCall.error")}
                </h4>
                <div className="overflow-x-auto rounded-md bg-destructive/10 text-xs text-destructive">
                    {errorText}
                </div>
            </div>
        );
    }
    if (output === undefined || output === "") {
        return null;
    }
    return (
        <div className={cn("space-y-2 p-4", className)} {...props}>
            <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t("chat.toolCall.output")}
            </h4>
            <div className="overflow-x-auto rounded-md bg-muted/50 text-xs text-foreground">
                <CodeBlock code={output} language="json" />
            </div>
        </div>
    );
}
