import {
    AnimateIcon,
    Button,
    CornerDownLeftIcon,
    formatDuration,
} from "@lemma/ui";
import {
    type KeyboardEvent,
    type ReactNode,
    useEffect,
    useRef,
    useState,
} from "react";
import { useTranslation } from "react-i18next";

import { useActiveSessionStore } from "../store";
import type { ModelSelection } from "../useModelSelection";
import { useStopwatch } from "../useStopwatch";
import { ModelPickerPopover } from "./ModelPickerPopover";

/** Provider and its enabled model ids displayed in the model picker. */
export interface SessionProviderGroup {
    id: string;
    name: string;
    enabled: boolean;
    models: { id: string }[];
}

interface SessionComposerProps {
    sessionKey: string;
    onSubmit?: ((trimmedText: string) => void) | undefined;
    streaming: boolean;
    focusTrigger?: number | undefined;
    model: ModelSelection | null;
    providers: SessionProviderGroup[];
    modelPickerOpen: boolean;
    onModelPickerOpenChange: (open: boolean) => void;
    onSelectModel: (selection: ModelSelection) => void;
    onOpenProviders: () => void;
    directorySlot: ReactNode;
    trailingFooter?: ReactNode;
    dock?: ReactNode;
    running?:
        | {
              stepLabel: string;
              startedAtMs?: number | undefined;
              warn: boolean;
              onStop: () => void;
          }
        | undefined;
}

/**
 * 680px composer with an optional top dock, a collapsible live status bar, an auto-growing input,
 * and the footer controls; it owns the per-session draft subscription so typing never re-renders the turn stage.
 */
export function SessionComposer({
    sessionKey,
    onSubmit,
    streaming,
    focusTrigger,
    model,
    providers,
    modelPickerOpen,
    onModelPickerOpenChange,
    onSelectModel,
    onOpenProviders,
    directorySlot,
    trailingFooter,
    dock,
    running,
}: SessionComposerProps) {
    const { t } = useTranslation();
    const draft = useActiveSessionStore(
        (state) => state.drafts[sessionKey] ?? "",
    );
    const setDraft = useActiveSessionStore((state) => state.setDraft);
    const [isComposing, setIsComposing] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const prevFocusTriggerRef = useRef(focusTrigger);
    const elapsed = useStopwatch(running?.startedAtMs);
    const trimmed = draft.trim();
    const disabled = model === null;
    const sendAllowed = !streaming && trimmed !== "" && !disabled;
    const placeholder = disabled
        ? t("session.noModelPlaceholder")
        : t("session.inputPlaceholder");

    useEffect(() => {
        if (
            focusTrigger !== undefined &&
            focusTrigger !== prevFocusTriggerRef.current
        ) {
            prevFocusTriggerRef.current = focusTrigger;
            textareaRef.current?.focus();
        }
    }, [focusTrigger]);

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !isComposing &&
            !event.nativeEvent.isComposing
        ) {
            event.preventDefault();
            if (sendAllowed) {
                onSubmit?.(trimmed);
            }
        }
    };

    return (
        <div className="w-full max-w-170 overflow-hidden rounded-lg border border-input bg-background shadow-raised transition-colors duration-base focus-within:border-foreground">
            <div
                className="grid-collapse"
                data-open={dock !== undefined}
                inert={dock === undefined}
            >
                <div>
                    {dock !== undefined && (
                        <div className="border-b border-border bg-sidebar px-3.5 py-2">
                            {dock}
                        </div>
                    )}
                </div>
            </div>
            <div
                className="grid-collapse"
                data-open={running !== undefined}
                inert={running === undefined}
            >
                <div>
                    {running !== undefined && (
                        <div className="flex items-center gap-2 border-b border-border bg-sidebar px-3 py-1.5 text-small">
                            {running.warn ? (
                                <span
                                    aria-hidden="true"
                                    className="size-1.5 shrink-0 rounded-full bg-warning"
                                />
                            ) : (
                                <span
                                    aria-hidden="true"
                                    className="live-dot shrink-0"
                                />
                            )}
                            <span className="min-w-0 flex-1 truncate text-foreground">
                                {running.stepLabel}
                            </span>
                            {elapsed !== undefined && (
                                <span className="shrink-0 text-caption text-subtle-foreground tabular-nums">
                                    {formatDuration(elapsed, true)}
                                </span>
                            )}
                            <Button
                                type="button"
                                size="xs"
                                variant="ghost"
                                onClick={running.onStop}
                            >
                                {t("agent.stopShort")}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
            <textarea
                ref={textareaRef}
                value={draft}
                onChange={(event) =>
                    setDraft(sessionKey, event.currentTarget.value)
                }
                onKeyDown={handleKeyDown}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                placeholder={placeholder}
                aria-label={placeholder}
                disabled={disabled}
                className="block field-sizing-content max-h-48 min-h-14 w-full resize-none bg-transparent px-3.5 pt-3 pb-1.5 text-reading text-foreground outline-none placeholder:text-subtle-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="flex items-center justify-between gap-2 px-2.5 pb-2">
                <div className="flex min-w-0 flex-1 items-center gap-1">
                    {directorySlot}
                    <ModelPickerPopover
                        open={modelPickerOpen}
                        onOpenChange={onModelPickerOpenChange}
                        model={model}
                        providers={providers}
                        onSelectModel={onSelectModel}
                        onOpenProviders={onOpenProviders}
                    />
                    {trailingFooter}
                </div>
                <AnimateIcon animateOnHover asChild>
                    <Button
                        type="button"
                        size="icon-sm"
                        aria-label={t("session.send")}
                        disabled={!sendAllowed}
                        onClick={() => onSubmit?.(trimmed)}
                    >
                        <CornerDownLeftIcon />
                    </Button>
                </AnimateIcon>
            </div>
        </div>
    );
}
