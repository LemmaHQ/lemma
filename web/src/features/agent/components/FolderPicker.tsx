import {
    AnchoredPicker,
    type AnchoredPickerItem,
    ChevronDownIcon,
    toast,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@lemma/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import type { SessionDirectoryControl } from "./SessionView";

interface FolderPickerProps {
    editable: boolean;
    directoryControl: SessionDirectoryControl;
}

function directoryBasename(directory: string): string {
    return directory.split(/[\\/]/u).findLast(Boolean) ?? directory;
}

/** Workspace folder selector for new sessions and static folder badge for existing sessions. */
export function FolderPicker({
    editable,
    directoryControl,
}: FolderPickerProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const {
        directory,
        recentDirectories,
        canPickDirectory,
        onSelectDirectory,
        onPickDirectory,
    } = directoryControl;

    if (!editable) {
        if (directory === undefined) {
            return null;
        }
        return (
            <Tooltip>
                <TooltipTrigger
                    render={
                        <span className="max-w-44 truncate px-1.5 font-mono text-small text-subtle-foreground" />
                    }
                >
                    {directoryBasename(directory)}
                </TooltipTrigger>
                <TooltipContent>{directory}</TooltipContent>
            </Tooltip>
        );
    }

    const label =
        directory === undefined
            ? t("sidebar.defaultWorkspace")
            : directoryBasename(directory);

    const directories =
        directory !== undefined && !recentDirectories.includes(directory)
            ? [directory, ...recentDirectories]
            : recentDirectories;

    const items: AnchoredPickerItem[] = [
        {
            id: "__default__",
            label: t("sidebar.defaultWorkspace"),
            selected: directory === undefined,
            onSelect: () => {
                onSelectDirectory?.(undefined);
            },
        },
        ...directories.map((dir) => ({
            id: dir,
            label: directoryBasename(dir),
            sublabel: dir,
            mono: true,
            selected: dir === directory,
            onSelect: () => {
                onSelectDirectory?.(dir);
            },
        })),
    ];

    const footerAction =
        canPickDirectory && onPickDirectory !== undefined
            ? {
                  label: t("session.chooseOtherFolder"),
                  onSelect: () => {
                      void (async () => {
                          try {
                              const picked = await onPickDirectory();
                              if (picked !== undefined) {
                                  onSelectDirectory?.(picked);
                              }
                          } catch (error) {
                              toast.error(errorText(error, t));
                          }
                      })();
                  },
              }
            : undefined;

    return (
        <AnchoredPicker
            open={open}
            onOpenChange={setOpen}
            side="top"
            searchPlaceholder={t("session.filterFolders")}
            emptyText={t("session.treeEmpty")}
            groups={[{ id: "folders", items }]}
            {...(footerAction === undefined ? {} : { footerAction })}
            trigger={
                <button
                    type="button"
                    className="inline-flex max-w-44 cursor-pointer items-center gap-1 rounded-md px-2 py-1 font-mono text-small text-muted-foreground transition-colors duration-base hover:bg-selected hover:text-foreground"
                >
                    <span className="min-w-0 truncate">{label}</span>
                    <span aria-hidden="true" className="shrink-0">
                        <ChevronDownIcon size={14} />
                    </span>
                </button>
            }
        />
    );
}
