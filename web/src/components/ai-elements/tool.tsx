"use client";

import { Badge } from "@/components/ui/badge";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ToolUIPart } from "ai";
import {
    IconCircleCheck as CheckCircleIcon,
    IconChevronDown as ChevronDownIcon,
    IconCircle as CircleIcon,
    IconClock as ClockIcon,
    IconTool as WrenchIcon,
    IconCircleX as XCircleIcon,
} from "@tabler/icons-react";
import type { ComponentProps, ReactNode } from "react";
import { isValidElement } from "react";
import { type TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { CodeBlock } from "./code-block";

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({ className, ...props }: ToolProps) => (
    <Collapsible
        className={cn("not-prose mb-4 w-full rounded-md border", className)}
        {...props}
    />
);

export type ToolHeaderProps = {
    title?: string;
    type: ToolUIPart["type"];
    state: ToolUIPart["state"];
    className?: string;
};

const getStatusBadge = (status: ToolUIPart["state"], t: TFunction) => {
    const labels: Record<ToolUIPart["state"], string> = {
        "input-streaming": t("chat.toolCall.pending"),
        "input-available": t("chat.toolCall.running"),
        "approval-requested": t("chat.toolCall.awaitingApproval"),
        "approval-responded": t("chat.toolCall.responded"),
        "output-available": t("chat.toolCall.done"),
        "output-error": t("chat.toolCall.failed"),
        "output-denied": t("chat.toolCall.denied"),
    };

    const icons: Record<ToolUIPart["state"], ReactNode> = {
        "input-streaming": <CircleIcon className="size-4" />,
        "input-available": <ClockIcon className="size-4 animate-pulse" />,
        "approval-requested": <ClockIcon className="size-4 text-yellow-600" />,
        "approval-responded": (
            <CheckCircleIcon className="size-4 text-blue-600" />
        ),
        "output-available": (
            <CheckCircleIcon className="size-4 text-green-600" />
        ),
        "output-error": <XCircleIcon className="size-4 text-red-600" />,
        "output-denied": <XCircleIcon className="size-4 text-orange-600" />,
    };

    return (
        <Badge className="gap-1.5 rounded-full text-xs" variant="secondary">
            {icons[status]}
            {labels[status]}
        </Badge>
    );
};

export const ToolHeader = ({
    className,
    title,
    type,
    state,
    ...props
}: ToolHeaderProps) => {
    const { t } = useTranslation();
    return (
        <CollapsibleTrigger
            className={cn(
                "flex w-full items-center justify-between gap-4 p-3",
                className,
            )}
            {...props}
        >
            <div className="flex items-center gap-2">
                <WrenchIcon className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                    {title ?? type.split("-").slice(1).join("-")}
                </span>
                {getStatusBadge(state, t)}
            </div>
            <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
    );
};

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
    <CollapsibleContent
        className={cn(
            "text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:animate-in data-[state=open]:slide-in-from-top-2",
            className,
        )}
        {...props}
    />
);

export type ToolInputProps = ComponentProps<"div"> & {
    input: ToolUIPart["input"];
};

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => {
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
};

export type ToolOutputProps = ComponentProps<"div"> & {
    output: ToolUIPart["output"];
    errorText: ToolUIPart["errorText"];
};

export const ToolOutput = ({
    className,
    output,
    errorText,
    ...props
}: ToolOutputProps) => {
    const { t } = useTranslation();
    if (!(output || errorText)) {
        return null;
    }

    let Output = <div>{output as ReactNode}</div>;

    if (typeof output === "object" && !isValidElement(output)) {
        Output = (
            <CodeBlock code={JSON.stringify(output, null, 2)} language="json" />
        );
    } else if (typeof output === "string") {
        Output = <CodeBlock code={output} language="json" />;
    }

    return (
        <div className={cn("space-y-2 p-4", className)} {...props}>
            <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {errorText
                    ? t("chat.toolCall.error")
                    : t("chat.toolCall.output")}
            </h4>
            <div
                className={cn(
                    "overflow-x-auto rounded-md text-xs [&_table]:w-full",
                    errorText
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted/50 text-foreground",
                )}
            >
                {errorText && <div>{errorText}</div>}
                {Output}
            </div>
        </div>
    );
};
