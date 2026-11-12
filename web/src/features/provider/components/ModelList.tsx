import {
    Button,
    CheckIcon,
    Empty,
    EmptyDescription,
    EmptyHeader,
    FieldDescription,
    FieldError,
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
    Item,
    ItemActions,
    ItemContent,
    ItemGroup,
    ItemSeparator,
    ItemTitle,
    PlusIcon,
    RefreshCwIcon,
    SearchIcon,
    Switch,
    XIcon,
} from "@lemma/ui";
import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import type { Model } from "../store";
import { FetchModelsDialog } from "./FetchModelsDialog";

interface ModelListProps {
    models: Model[];
    onChange: (models: Model[]) => void;
    onFetch: () => Promise<string[]>;
}

export function ModelList({ models, onChange, onFetch }: ModelListProps) {
    const { t } = useTranslation();
    const [query, setQuery] = useState("");
    const [fetching, setFetching] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [remote, setRemote] = useState<string[] | null>(null);
    const [adding, setAdding] = useState(false);
    const [newModel, setNewModel] = useState("");

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q === ""
            ? models
            : models.filter((m) => m.id.toLowerCase().includes(q));
    }, [models, query]);

    const fetchRemote = async () => {
        setFetching(true);
        setFetchError(null);
        try {
            setRemote(await onFetch());
        } catch (e) {
            setFetchError(errorText(e, t));
        } finally {
            setFetching(false);
        }
    };

    const confirmAdd = () => {
        const id = newModel.trim();
        setNewModel("");
        setAdding(false);
        if (id === "" || models.some((model) => model.id === id)) {
            return;
        }
        onChange([{ id, toolCalling: true }, ...models]);
    };

    const remove = (id: string) =>
        onChange(models.filter((model) => model.id !== id));

    const setToolCalling = (id: string, toolCalling: boolean) =>
        onChange(
            models.map((model) =>
                model.id === id ? { ...model, toolCalling } : model,
            ),
        );

    return (
        <section className="flex flex-col gap-3 pt-6">
            <div className="flex items-center gap-2">
                <h3 className="text-title">{t("provider.modelList")}</h3>
                <div className="ml-auto flex items-center gap-2">
                    <InputGroup className="w-48">
                        <InputGroupAddon>
                            <SearchIcon />
                        </InputGroupAddon>
                        <InputGroupInput
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t("provider.modelSearchPlaceholder")}
                        />
                    </InputGroup>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => void fetchRemote()}
                        loading={fetching}
                    >
                        {!fetching && <RefreshCwIcon />}
                        {t("provider.fetchModelList")}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={t("provider.addModel")}
                        onClick={() => setAdding((v) => !v)}
                    >
                        <PlusIcon />
                    </Button>
                </div>
            </div>
            <FieldDescription>{t("provider.toolCallingDesc")}</FieldDescription>

            {fetchError !== null && <FieldError>{fetchError}</FieldError>}

            <FetchModelsDialog
                remote={remote}
                existing={models.map((model) => model.id)}
                onClose={() => setRemote(null)}
                onAdd={(picked) => {
                    onChange([
                        ...models,
                        ...picked.map((id) => ({ id, toolCalling: true })),
                    ]);
                    setRemote(null);
                }}
            />

            {adding && (
                <InputGroup>
                    <InputGroupInput
                        value={newModel}
                        onChange={(e) => setNewModel(e.target.value)}
                        placeholder={t("provider.modelPlaceholder")}
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
                            aria-label={t("provider.addModel")}
                            onClick={confirmAdd}
                            disabled={newModel.trim() === ""}
                        >
                            <CheckIcon />
                        </InputGroupButton>
                        <InputGroupButton
                            size="icon-xs"
                            aria-label={t("common.cancel")}
                            onClick={() => {
                                setNewModel("");
                                setAdding(false);
                            }}
                        >
                            <XIcon />
                        </InputGroupButton>
                    </InputGroupAddon>
                </InputGroup>
            )}

            {visible.length > 0 ? (
                <ItemGroup>
                    {visible.map((model, index) => (
                        <Fragment key={model.id}>
                            {index > 0 && <ItemSeparator />}
                            <Item size="xs">
                                <ItemContent>
                                    <ItemTitle>{model.id}</ItemTitle>
                                </ItemContent>
                                <ItemActions>
                                    <span className="text-small text-muted-foreground">
                                        {t("provider.toolCalling")}
                                    </span>
                                    <Switch
                                        checked={model.toolCalling}
                                        onCheckedChange={(checked) =>
                                            setToolCalling(model.id, checked)
                                        }
                                        aria-label={`${model.id} ${t("provider.toolCalling")}`}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label={t("provider.removeModel")}
                                        onClick={() => remove(model.id)}
                                    >
                                        <XIcon />
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
                            {t("provider.noModels")}
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            )}
        </section>
    );
}
