import { CheckIcon } from "#icons/check";
import { cn } from "#lib/cn";

export type AnchoredPickerItem = {
    id: string;
    label: string;
    sublabel?: string;
    mono?: boolean;
    selected?: boolean;
    onSelect: () => void;
};

export type AnchoredPickerGroup = {
    id: string;
    label?: string;
    actionLabel?: string;
    onAction?: () => void;
    items: AnchoredPickerItem[];
};

export function AnchoredPickerGroupView({
    baseId,
    group,
    offset,
    safeIndex,
    onHoverIndex,
    onSelectItem,
}: {
    baseId: string;
    group: AnchoredPickerGroup;
    offset: number;
    safeIndex: number;
    onHoverIndex: (index: number) => void;
    onSelectItem: (item: AnchoredPickerItem) => void;
}) {
    const labelId = `${baseId}-grp-${group.id}`;
    const hasAction =
        group.actionLabel !== undefined && group.onAction !== undefined;

    return (
        <div
            role="group"
            aria-labelledby={group.label === undefined ? undefined : labelId}
            className="pb-1"
        >
            {(group.label !== undefined || hasAction) && (
                <div
                    role="presentation"
                    className="flex items-center justify-between px-2 pt-2 pb-1"
                >
                    {group.label !== undefined && (
                        <span
                            id={labelId}
                            className="text-caption font-medium text-subtle-foreground"
                        >
                            {group.label}
                        </span>
                    )}
                    {hasAction && (
                        <button
                            type="button"
                            onClick={group.onAction}
                            className="cursor-pointer text-caption text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {group.actionLabel}
                        </button>
                    )}
                </div>
            )}
            {group.items.map((item, localIndex) => {
                const itemIndex = offset + localIndex;
                const active = itemIndex === safeIndex;
                return (
                    <button
                        key={item.id}
                        id={`${baseId}-opt-${item.id}`}
                        type="button"
                        role="option"
                        aria-selected={item.selected === true}
                        data-active={active ? "" : undefined}
                        onMouseEnter={() => onHoverIndex(itemIndex)}
                        onClick={() => onSelectItem(item)}
                        className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-small text-foreground outline-none hover:bg-accent data-active:bg-accent"
                    >
                        <span className="min-w-0 flex-1">
                            <span
                                className={cn(
                                    "block truncate",
                                    item.mono === true &&
                                        "font-mono text-caption",
                                )}
                            >
                                {item.label}
                            </span>
                            {item.sublabel !== undefined && (
                                <span className="block truncate text-caption text-subtle-foreground">
                                    {item.sublabel}
                                </span>
                            )}
                        </span>
                        {item.selected === true && (
                            <CheckIcon
                                aria-hidden="true"
                                className="size-4 shrink-0 text-foreground"
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
