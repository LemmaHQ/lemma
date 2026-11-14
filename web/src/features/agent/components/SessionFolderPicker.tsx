import {
    AnchoredPicker,
    type AnchoredPickerItem,
    ChevronDownIcon,
    toast,
} from "@lemma/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import { lastPathSegment } from "../tool-output";

/** Workspace directory selection state and callbacks for a new session. */
export interface SessionDirectoryControl {
    directory: string | undefined;
    recentDirectories: string[];
    canPickDirectory: boolean;
    onSelectDirectory?: ((dir: string | undefined) => void) | undefined;
    onPickDirectory?: (() => Promise<string | undefined>) | undefined;
}

interface SessionFolderPickerProps {
    directoryControl: SessionDirectoryControl;
}

/** Interactive workspace folder picker popover for the new-session composer. */
export function SessionFolderPicker({
    directoryControl,
}: SessionFolderPickerProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const {
        directory,
        recentDirectories,
        canPickDirectory,
        onSelectDirectory,
        onPickDirectory,
    } = directoryControl;

    const label =
        directory === undefined
            ? t("sidebar.defaultWorkspace")
            : lastPathSegment(directory);

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
            label: lastPathSegment(dir),
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
            footerAction={footerAction}
            trigger={
                <button
                    type="button"
                    className="inline-flex max-w-44 cursor-pointer items-center gap-1 rounded-md px-2 py-1 font-mono text-small text-muted-foreground transition-colors duration-base hover:bg-selected hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
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
