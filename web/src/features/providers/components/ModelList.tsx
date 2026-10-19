import {
    IconCheck,
    IconPlus,
    IconRefresh,
    IconSearch,
    IconX,
} from "@tabler/icons-react";
import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@/components/ui/input-group";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemGroup,
    ItemSeparator,
    ItemTitle,
} from "@/components/ui/item";
import { errorText } from "@/data/rpc/errors";
import { cn } from "@/lib/utils";

interface ModelListProps {
    models: string[];
    onChange: (models: string[]) => void;
    onFetch: () => Promise<string[]>;
}

export function ModelList({ models, onChange, onFetch }: ModelListProps) {
    const { t } = useTranslation();
    const [query, setQuery] = useState("");
    const [fetching, setFetching] = useState(false);
    const [fetchMsg, setFetchMsg] = useState<
        { ok: true; text: string } | { ok: false; text: string } | null
    >(null);
    const [adding, setAdding] = useState(false);
    const [newModel, setNewModel] = useState("");

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q === ""
            ? models
            : models.filter((m) => m.toLowerCase().includes(q));
    }, [models, query]);

    const fetchRemote = async () => {
        if (fetching) {
            return;
        }
        setFetching(true);
        setFetchMsg(null);
        try {
            const remote = await onFetch();
            onChange(Array.from(new Set([...models, ...remote])));
            setFetchMsg({ ok: true, text: t("providers.modelsFetched") });
        } catch (e) {
            setFetchMsg({ ok: false, text: errorText(e, t) });
        } finally {
            setFetching(false);
        }
    };

    const confirmAdd = () => {
        const id = newModel.trim();
        setNewModel("");
        setAdding(false);
        if (id === "" || models.includes(id)) {
            return;
        }
        onChange([id, ...models]);
    };

    const remove = (id: string) => onChange(models.filter((m) => m !== id));

    return (
        <section className="pt-6">
            <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">
                    {t("providers.modelList")}
                </h3>
                <div className="ml-auto flex items-center gap-2">
                    <InputGroup className="w-48">
                        <InputGroupAddon>
                            <IconSearch />
                        </InputGroupAddon>
                        <InputGroupInput
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t("providers.modelSearchPlaceholder")}
                        />
                    </InputGroup>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void fetchRemote()}
                        disabled={fetching}
                    >
                        <IconRefresh
                            className={cn(
                                "size-3.5",
                                fetching && "animate-spin",
                            )}
                        />
                        {fetching
                            ? t("providers.fetchingModels")
                            : t("providers.fetchModelList")}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8"
                        aria-label={t("providers.addModel")}
                        onClick={() => setAdding((v) => !v)}
                    >
                        <IconPlus className="size-4" />
                    </Button>
                </div>
            </div>

            {fetchMsg !== null && (
                <p
                    className={cn(
                        "pt-2 text-xs",
                        fetchMsg.ok
                            ? "text-muted-foreground"
                            : "text-destructive",
                    )}
                >
                    {fetchMsg.text}
                </p>
            )}

            {adding && (
                <div className="flex items-center gap-2 border-b border-border/60 py-3">
                    <Input
                        value={newModel}
                        onChange={(e) => setNewModel(e.target.value)}
                        placeholder={t("providers.modelPlaceholder")}
                        className="h-8 flex-1 font-mono"
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                confirmAdd();
                            } else if (e.key === "Escape") {
                                setNewModel("");
                                setAdding(false);
                            }
                        }}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8 shrink-0"
                        aria-label={t("providers.addModel")}
                        onClick={confirmAdd}
                        disabled={newModel.trim() === ""}
                    >
                        <IconCheck className="size-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        aria-label={t("common.cancel")}
                        onClick={() => {
                            setNewModel("");
                            setAdding(false);
                        }}
                    >
                        <IconX className="size-4" />
                    </Button>
                </div>
            )}

            {visible.length > 0 ? (
                <ItemGroup>
                    {visible.map((model, index) => (
                        <Fragment key={model}>
                            {index > 0 && <ItemSeparator />}
                            <Item size="xs">
                                <ItemContent>
                                    <ItemTitle>{model}</ItemTitle>
                                </ItemContent>
                                <ItemActions>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label={t("providers.removeModel")}
                                        onClick={() => remove(model)}
                                    >
                                        <IconX />
                                    </Button>
                                </ItemActions>
                            </Item>
                        </Fragment>
                    ))}
                </ItemGroup>
            ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                    {t("providers.noModels")}
                </p>
            )}
        </section>
    );
}
