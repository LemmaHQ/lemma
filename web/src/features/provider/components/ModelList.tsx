import {
    Button,
    CheckIcon,
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
    SettingsRow,
    SettingsSectionCompact,
    Switch,
    XIcon,
} from "@lemma/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import type { Model } from "../store";
import { FetchModelsDialog } from "./FetchModelsDialog";

interface ModelListProps {
    models: Model[];
    fetchDisabled: boolean;
    onChange: (models: Model[]) => void;
    onFetch: () => Promise<string[]>;
}

export function ModelList({
    models,
    fetchDisabled,
    onChange,
    onFetch,
}: ModelListProps) {
    const { t } = useTranslation();
    const [fetching, setFetching] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [remote, setRemote] = useState<string[] | null>(null);
    const [adding, setAdding] = useState(false);
    const [newModel, setNewModel] = useState("");

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
        onChange([...models, { id, toolCalling: true }]);
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
        <>
            <SettingsSectionCompact
                title={t("provider.modelListHint")}
                error={fetchError}
                actions={
                    <>
                        <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            disabled={fetchDisabled}
                            onClick={() => void fetchRemote()}
                            loading={fetching}
                        >
                            {t("provider.fetchModelList")}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => setAdding((v) => !v)}
                        >
                            {t("provider.addModel")}
                        </Button>
                    </>
                }
            >
                {models.map((model) => (
                    <SettingsRow
                        key={model.id}
                        label={
                            <span className="font-mono text-small">
                                {model.id}
                            </span>
                        }
                    >
                        <button
                            type="button"
                            aria-label={t("provider.removeModel")}
                            onClick={() => remove(model.id)}
                            className="cursor-pointer rounded-md px-2 py-0.5 text-caption text-subtle-foreground opacity-100 transition-opacity duration-fast hover:bg-selected hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring pointer-fine:opacity-0 pointer-fine:group-hover/settings-row:opacity-100"
                        >
                            {t("provider.removeAction")}
                        </button>
                        <Switch
                            checked={model.toolCalling}
                            onCheckedChange={(checked) =>
                                setToolCalling(model.id, checked)
                            }
                            aria-label={`${model.id} ${t("provider.toolCalling")}`}
                        />
                    </SettingsRow>
                ))}
                {adding && (
                    <div className="py-2">
                        <InputGroup>
                            <InputGroupInput
                                aria-label={t("provider.addModel")}
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
                    </div>
                )}
                {models.length === 0 && !adding && (
                    <p className="py-2.5 text-small text-muted-foreground">
                        {t("provider.emptyModels")}
                    </p>
                )}
            </SettingsSectionCompact>
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
        </>
    );
}
