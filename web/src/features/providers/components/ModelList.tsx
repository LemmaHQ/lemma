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
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { FieldDescription, FieldError } from "@/components/ui/field";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
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
import { Spinner } from "@/components/ui/spinner";
import { errorText } from "@/data/rpc/errors";

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
        <section className="flex flex-col gap-3 pt-6">
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
                        onClick={() => void fetchRemote()}
                        disabled={fetching}
                    >
                        {fetching ? <Spinner /> : <IconRefresh />}
                        {fetching
                            ? t("providers.fetchingModels")
                            : t("providers.fetchModelList")}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={t("providers.addModel")}
                        onClick={() => setAdding((v) => !v)}
                    >
                        <IconPlus />
                    </Button>
                </div>
            </div>

            {fetchMsg !== null &&
                (fetchMsg.ok ? (
                    <FieldDescription>{fetchMsg.text}</FieldDescription>
                ) : (
                    <FieldError>{fetchMsg.text}</FieldError>
                ))}

            {adding && (
                <InputGroup>
                    <InputGroupInput
                        value={newModel}
                        onChange={(e) => setNewModel(e.target.value)}
                        placeholder={t("providers.modelPlaceholder")}
                        className="font-mono"
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
                    <InputGroupAddon align="inline-end">
                        <InputGroupButton
                            size="icon-xs"
                            aria-label={t("providers.addModel")}
                            onClick={confirmAdd}
                            disabled={newModel.trim() === ""}
                        >
                            <IconCheck />
                        </InputGroupButton>
                        <InputGroupButton
                            size="icon-xs"
                            aria-label={t("common.cancel")}
                            onClick={() => {
                                setNewModel("");
                                setAdding(false);
                            }}
                        >
                            <IconX />
                        </InputGroupButton>
                    </InputGroupAddon>
                </InputGroup>
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
                <Empty>
                    <EmptyHeader>
                        <EmptyDescription>
                            {t("providers.noModels")}
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            )}
        </section>
    );
}
