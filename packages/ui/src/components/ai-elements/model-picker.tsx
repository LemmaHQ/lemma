import { Menu } from "@base-ui/react/menu";
import {
    type CSSProperties,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { useTranslation } from "react-i18next";

import { PromptInputButton } from "#components/ai-elements/prompt-input";
import { CheckIcon } from "#icons/check";
import { ChevronDownIcon } from "#icons/chevron-down";

export interface ModelPickerSelection {
    providerId: string;
    model: string;
}

export interface ModelPickerOption extends ModelPickerSelection {
    providerName: string;
}

interface ModelPickerProps {
    selection: ModelPickerSelection | null;
    options: ModelPickerOption[];
    onSelect: (selection: ModelPickerSelection) => void;
}

interface PillPosition {
    top: number;
    height: number;
    visible: boolean;
    glide: boolean;
}

const COLLISION_PADDING = { top: 48, right: 8, bottom: 8, left: 8 };
const HIDDEN_PILL = { top: 0, height: 0, visible: false, glide: false };

export function ModelPicker({
    selection,
    options,
    onSelect,
}: ModelPickerProps) {
    const { t } = useTranslation("ui");
    const [open, setOpen] = useState(false);
    const [pill, setPill] = useState<PillPosition>(HIDDEN_PILL);
    const popupRef = useRef<HTMLDivElement>(null);
    const selectionKey = selection === null ? null : modelKey(selection);
    const groups = [...Map.groupBy(options, (option) => option.providerName)];

    const updatePill = useCallback(
        (item: HTMLElement | null, glide: boolean) => {
            if (item === null) {
                setPill(HIDDEN_PILL);
                return;
            }
            if (item.offsetHeight === 0) {
                return;
            }
            setPill({
                top: item.offsetTop,
                height: item.offsetHeight,
                visible: true,
                glide,
            });
        },
        [],
    );

    useEffect(() => {
        if (!open) {
            return;
        }
        const frame = requestAnimationFrame(() => {
            const popup = popupRef.current;
            const item =
                options.length === 0 || selectionKey === null
                    ? null
                    : (popup?.querySelector<HTMLElement>(
                          "[data-highlighted]",
                      ) ??
                      popup?.querySelector<HTMLElement>("[data-checked]") ??
                      null);
            updatePill(item, false);
        });
        return () => cancelAnimationFrame(frame);
    }, [open, options, selectionKey, updatePill]);

    const pillStyle = {
        "--model-picker-pill-y": `${pill.top}px`,
        "--model-picker-pill-height": `${pill.height}px`,
    } as CSSProperties;

    return (
        <Menu.Root
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (!nextOpen) {
                    setPill(HIDDEN_PILL);
                }
            }}
            onItemHighlighted={(item, details) => {
                const target =
                    item ??
                    popupRef.current?.querySelector<HTMLElement>(
                        "[data-checked]",
                    ) ??
                    null;
                updatePill(target, details.reason !== "none");
            }}
        >
            <Menu.Trigger
                render={
                    <PromptInputButton
                        aria-label={t("conversation.selectModel")}
                        className="ui-model-picker-trigger max-w-48 gap-1"
                        disabled={options.length === 0}
                    />
                }
            >
                <span
                    key={selectionKey ?? "none"}
                    className="ui-model-picker-face"
                    data-morph
                >
                    <span className="ui-model-picker-name">
                        {selection?.model ?? t("conversation.noProvider")}
                    </span>
                </span>
                <ChevronDownIcon className="ui-model-picker-chevron size-3.5" />
            </Menu.Trigger>
            <Menu.Portal keepMounted>
                <Menu.Positioner
                    align="start"
                    className="isolate z-50 outline-none"
                    collisionPadding={COLLISION_PADDING}
                    side="top"
                    sideOffset={6}
                >
                    <Menu.Popup
                        ref={popupRef}
                        aria-label={t("conversation.selectModel")}
                        className="ui-model-picker-popup relative w-64 max-w-(--available-width) overflow-x-hidden overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-modal outline-none"
                    >
                        <span
                            aria-hidden="true"
                            className="ui-model-picker-fill"
                            data-glide={pill.glide}
                            data-visible={pill.visible}
                            style={pillStyle}
                        />
                        <Menu.RadioGroup
                            className="contents"
                            value={selectionKey}
                            onValueChange={(value: string) => {
                                const option = options.find(
                                    (candidate) =>
                                        modelKey(candidate) === value,
                                );
                                if (option !== undefined) {
                                    onSelect({
                                        providerId: option.providerId,
                                        model: option.model,
                                    });
                                }
                            }}
                        >
                            {groups.map(([providerName, models]) => (
                                <Menu.Group
                                    key={providerName}
                                    className="ui-model-picker-group"
                                >
                                    <Menu.GroupLabel className="px-2.5 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                                        {providerName}
                                    </Menu.GroupLabel>
                                    {models.map((option) => (
                                        <Menu.RadioItem
                                            key={modelKey(option)}
                                            closeOnClick
                                            className="ui-model-picker-option relative flex min-h-9 cursor-default items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none select-none"
                                            label={option.model}
                                            value={modelKey(option)}
                                        >
                                            <span className="min-w-0 flex-1 text-left font-medium wrap-break-word">
                                                {option.model}
                                            </span>
                                            <CheckIcon
                                                aria-hidden="true"
                                                className="ui-model-picker-check size-4"
                                            />
                                        </Menu.RadioItem>
                                    ))}
                                </Menu.Group>
                            ))}
                        </Menu.RadioGroup>
                    </Menu.Popup>
                </Menu.Positioner>
            </Menu.Portal>
        </Menu.Root>
    );
}

function modelKey(selection: ModelPickerSelection) {
    return JSON.stringify([selection.providerId, selection.model]);
}
