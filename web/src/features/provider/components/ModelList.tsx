import {
    Button,
    CheckIcon,
    Empty,
    EmptyDescription,
    EmptyHeader,
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
    PlusIcon,
    RefreshCwIcon,
    SearchIcon,
    SettingsField,
    SettingsRow,
    SettingsSection,
    XIcon,
} from "@lemma/ui";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import { FetchModelsDialog } from "./FetchModelsDialog";

interface ModelListProps {
    models: string[];
    onChange: (models: string[]) => void;
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
            : models.filter((m) => m.toLowerCase().includes(q));
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
        if (id === "" || models.includes(id)) {
            return;
        }
        onChange([id, ...models]);
    };

    const remove = (id: string) => onChange(models.filter((m) => m !== id));

    return (
        <>
            <SettingsSection
                title={t("provider.modelList")}
                error={fetchError}
                actions={
                    <>
                        <InputGroup className="w-48">
                            <InputGroupAddon>
                                <SearchIcon />
                            </InputGroupAddon>
                            <InputGroupInput
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={t(
                                    "provider.modelSearchPlaceholder",
                                )}
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
                    </>
                }
            >
                {adding && (
                    <SettingsField
                        label={t("provider.addModel")}
                        htmlFor="provider-new-model"
                    >
                        <InputGroup>
                            <InputGroupInput
                                id="provider-new-model"
                                value={newModel}
                                onChange={(e) => setNewModel(e.target.value)}
                                placeholder={t("provider.modelPlaceholder")}
                                onKeyDown={(e) => {
                                    if (e.nativeEvent.isComposing) {
                                        return;
                                    }
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
                    </SettingsField>
                )}
                {visible.length > 0 ? (
                    visible.map((model) => (
                        <SettingsRow key={model} label={model}>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t("provider.removeModel")}
                                onClick={() => remove(model)}
                            >
                                <XIcon />
                            </Button>
                        </SettingsRow>
                    ))
                ) : (
                    <Empty>
                        <EmptyHeader>
                            <EmptyDescription>
                                {t("provider.noModels")}
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                )}
            </SettingsSection>
            <FetchModelsDialog
                remote={remote}
                existing={models}
                onClose={() => setRemote(null)}
                onAdd={(picked) => {
                    onChange([...models, ...picked]);
                    setRemote(null);
                }}
            />
        </>
    );
}
