import { Button } from "@lemma/ui/components/button";
import { Checkbox } from "@lemma/ui/components/checkbox";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@lemma/ui/components/input-group";
import { SearchIcon } from "@lemma/ui/icons/search";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@lemma/ui/components/dialog";

interface FetchModelsDialogProps {
    /** Upstream models of the last fetch; `null` keeps the dialog closed. */
    remote: string[] | null;
    existing: string[];
    onClose: () => void;
    onAdd: (models: string[]) => void;
}

/** Dialog listing fetched upstream models for the user to pick which ones join the list. */
export function FetchModelsDialog({
    remote,
    existing,
    onClose,
    onAdd,
}: FetchModelsDialogProps) {
    const { t } = useTranslation();
    return (
        <Dialog
            open={remote !== null}
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t("providers.pickModelsTitle")}</DialogTitle>
                    <DialogDescription>
                        {t("providers.pickModelsDesc", {
                            count: remote?.length ?? 0,
                        })}
                    </DialogDescription>
                </DialogHeader>
                {remote !== null && (
                    <ModelPicker
                        remote={remote}
                        existing={existing}
                        onAdd={onAdd}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

interface ModelPickerProps {
    remote: string[];
    existing: string[];
    onAdd: (models: string[]) => void;
}

function ModelPicker({ remote, existing, onAdd }: ModelPickerProps) {
    const { t } = useTranslation();
    const [query, setQuery] = useState("");
    const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
    const added = useMemo(() => new Set(existing), [existing]);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q === ""
            ? remote
            : remote.filter((m) => m.toLowerCase().includes(q));
    }, [remote, query]);
    const selectable = visible.filter((m) => !added.has(m));
    const allPicked =
        selectable.length > 0 && selectable.every((m) => picked.has(m));
    const somePicked = selectable.some((m) => picked.has(m));

    const toggle = (model: string, on: boolean) => {
        setPicked((prev) => {
            const next = new Set(prev);
            if (on) {
                next.add(model);
            } else {
                next.delete(model);
            }
            return next;
        });
    };

    const toggleAll = (on: boolean) => {
        setPicked((prev) => {
            const next = new Set(prev);
            for (const m of selectable) {
                if (on) {
                    next.add(m);
                } else {
                    next.delete(m);
                }
            }
            return next;
        });
    };

    return (
        <>
            <InputGroup>
                <InputGroupAddon>
                    <SearchIcon />
                </InputGroupAddon>
                <InputGroupInput
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("providers.modelSearchPlaceholder")}
                />
            </InputGroup>
            <label className="flex items-center gap-2 px-2 text-muted-foreground">
                <Checkbox
                    checked={allPicked}
                    indeterminate={somePicked && !allPicked}
                    disabled={selectable.length === 0}
                    onCheckedChange={(on) => toggleAll(on)}
                />
                {t("providers.selectAll")}
            </label>
            <div className="-mx-1 max-h-80 overflow-y-auto">
                {visible.length > 0 ? (
                    visible.map((model) => {
                        const isAdded = added.has(model);
                        return (
                            <label
                                key={model}
                                className="flex items-center gap-2 rounded-md px-3 py-1.5 hover:bg-control-hover has-disabled:hover:bg-transparent"
                            >
                                <Checkbox
                                    checked={isAdded || picked.has(model)}
                                    disabled={isAdded}
                                    onCheckedChange={(on) => toggle(model, on)}
                                />
                                <span className="min-w-0 flex-1 truncate">
                                    {model}
                                </span>
                                {isAdded && (
                                    <span className="text-xs text-muted-foreground">
                                        {t("providers.modelAdded")}
                                    </span>
                                )}
                            </label>
                        );
                    })
                ) : (
                    <p className="px-3 py-6 text-center text-muted-foreground">
                        {t("providers.noModels")}
                    </p>
                )}
            </div>
            <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                    {t("common.cancel")}
                </DialogClose>
                <Button
                    type="button"
                    disabled={picked.size === 0}
                    onClick={() => onAdd(remote.filter((m) => picked.has(m)))}
                >
                    {t("providers.addPicked", { count: picked.size })}
                </Button>
            </DialogFooter>
        </>
    );
}
