import { IconLock, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { Provider } from "@/gen/lemma/v1/provider_pb";
import { errorText } from "@/data/rpc/errors";

import { ApiKeyInput } from "./ApiKeyInput";
import { ModelList } from "./ModelList";

interface ProviderDetailProps {
    provider: Provider;
    onToggleEnabled: (enabled: boolean) => void;
    onSaveBaseUrl: (baseUrl: string) => Promise<void>;
    onSaveName: (name: string) => Promise<void>;
    onSaveApiKey: (apiKey: string) => Promise<void>;
    onModelsChange: (models: string[]) => void;
    onFetchModels: () => Promise<string[]>;
    onDelete: () => void | Promise<void>;
}

export function ProviderDetail({
    provider,
    onToggleEnabled,
    onSaveBaseUrl,
    onSaveName,
    onSaveApiKey,
    onModelsChange,
    onFetchModels,
    onDelete,
}: ProviderDetailProps) {
    const { t } = useTranslation();
    const [apiKey, setApiKey] = useState(provider.apiKey);
    const [name, setName] = useState(provider.name);
    const [baseUrl, setBaseUrl] = useState(provider.baseUrl);
    const [savingKey, setSavingKey] = useState(false);
    const [savingName, setSavingName] = useState(false);
    const [savingUrl, setSavingUrl] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const apiKeyDirty = apiKey.trim() !== provider.apiKey.trim();
    const nameDirty = name.trim() !== provider.name && name.trim().length > 0;
    const baseUrlDirty =
        baseUrl.trim() !== provider.baseUrl && baseUrl.trim().length > 0;

    const saveApiKey = async () => {
        setSavingKey(true);
        setError(null);
        try {
            await onSaveApiKey(apiKey.trim());
        } catch (e) {
            setError(errorText(e, t));
        } finally {
            setSavingKey(false);
        }
    };

    const saveBaseUrl = async () => {
        setSavingUrl(true);
        setError(null);
        try {
            await onSaveBaseUrl(baseUrl.trim());
        } catch (e) {
            setError(errorText(e, t));
        } finally {
            setSavingUrl(false);
        }
    };

    const saveName = async () => {
        setSavingName(true);
        setError(null);
        try {
            await onSaveName(name.trim());
        } catch (e) {
            setError(errorText(e, t));
        } finally {
            setSavingName(false);
        }
    };

    const handleDelete = async () => {
        setError(null);
        try {
            await onDelete();
        } catch (e) {
            setError(errorText(e, t));
        }
    };

    return (
        <div className="max-w-3xl px-8 py-6">
            <header className="flex items-center gap-3">
                <Avatar>
                    <AvatarFallback>
                        {provider.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <h2 className="text-base font-semibold">{provider.name}</h2>
                <div className="ml-auto flex items-center gap-3">
                    <AlertDialog>
                        <AlertDialogTrigger
                            render={
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    aria-label={t("providers.deleteProvider")}
                                />
                            }
                        >
                            <IconTrash />
                        </AlertDialogTrigger>
                        <AlertDialogContent size="sm">
                            <AlertDialogHeader>
                                <AlertDialogTitle>
                                    {t("providers.deleteTitle")}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    {t("providers.deleteDescription")}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>
                                    {t("common.cancel")}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    variant="destructive"
                                    onClick={() => void handleDelete()}
                                >
                                    {t("common.delete")}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <Switch
                        checked={provider.enabled}
                        onCheckedChange={onToggleEnabled}
                        aria-label={t("providers.enableProvider")}
                    />
                </div>
            </header>

            <FieldGroup className="mt-6">
                <Field orientation="responsive">
                    <FieldContent>
                        <FieldLabel htmlFor="pd-identifier">
                            {t("providers.identifier")}
                        </FieldLabel>
                        <FieldDescription>
                            {t("providers.identifierHint")}
                        </FieldDescription>
                    </FieldContent>
                    <Input
                        id="pd-identifier"
                        value={provider.identifier}
                        readOnly
                        disabled
                    />
                </Field>
                <FieldSeparator />
                <Field orientation="responsive">
                    <FieldContent>
                        <FieldLabel htmlFor="pd-name">
                            {t("providers.name")}
                        </FieldLabel>
                        <FieldDescription>
                            {t("providers.nameDesc")}
                        </FieldDescription>
                    </FieldContent>
                    <ButtonGroup>
                        <Input
                            id="pd-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t("providers.namePlaceholder")}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            disabled={!nameDirty || savingName}
                            onClick={() => void saveName()}
                        >
                            {t("common.save")}
                        </Button>
                    </ButtonGroup>
                </Field>
                <FieldSeparator />
                <Field orientation="responsive">
                    <FieldContent>
                        <FieldLabel htmlFor="pd-apikey">
                            {t("providers.apiKey")}
                        </FieldLabel>
                        <FieldDescription>
                            {t("providers.apiKeyDesc")}
                        </FieldDescription>
                    </FieldContent>
                    <ButtonGroup>
                        <ApiKeyInput
                            id="pd-apikey"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder={t("providers.apiKeyPlaceholder")}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            disabled={!apiKeyDirty || savingKey}
                            onClick={() => void saveApiKey()}
                        >
                            {t("common.save")}
                        </Button>
                    </ButtonGroup>
                </Field>
                <FieldSeparator />
                <Field orientation="responsive">
                    <FieldContent>
                        <FieldLabel htmlFor="pd-baseurl">
                            {t("providers.baseUrl")}
                        </FieldLabel>
                        <FieldDescription>
                            {t("providers.baseUrlDesc")}
                        </FieldDescription>
                    </FieldContent>
                    <ButtonGroup>
                        <Input
                            id="pd-baseurl"
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            placeholder={t("providers.baseUrlPlaceholder")}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            disabled={!baseUrlDirty || savingUrl}
                            onClick={() => void saveBaseUrl()}
                        >
                            {t("common.save")}
                        </Button>
                    </ButtonGroup>
                </Field>
                {error !== null && <FieldError>{error}</FieldError>}
                <FieldDescription>
                    <IconLock className="inline size-3.5" />{" "}
                    {t("providers.securityNote")}
                </FieldDescription>
            </FieldGroup>

            <ModelList
                models={provider.models}
                onChange={onModelsChange}
                onFetch={onFetchModels}
            />
        </div>
    );
}
