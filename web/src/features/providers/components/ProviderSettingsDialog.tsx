import { AnimateIcon } from "@animate-ui/react/icons";
import { Button } from "@lemma/ui/components/button";
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@lemma/ui/components/field";
import { Input } from "@lemma/ui/components/input";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@lemma/ui/components/tooltip";
import { SettingsIcon } from "@lemma/ui/icons/settings";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@lemma/ui/components/dialog";
import { errorText } from "@/data/rpc/errors";
import type { Provider } from "@/gen/lemma/v1/provider_pb";

interface ProviderSettingsDialogProps {
    provider: Provider;
    onSaveName: (name: string) => Promise<void>;
}

/** Settings button opening a dialog with the provider ID and an editable name. */
export function ProviderSettingsDialog({
    provider,
    onSaveName,
}: ProviderSettingsDialogProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [name, setName] = useState(provider.name);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const nextName = name.trim() === "" ? provider.identifier : name.trim();

    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        if (next) {
            setName(provider.name);
            setError(null);
        }
    };

    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            await onSaveName(nextName);
            setOpen(false);
        } catch (e) {
            setError(errorText(e, t));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <Tooltip>
                <AnimateIcon animateOnHover asChild>
                    <TooltipTrigger
                        render={
                            <DialogTrigger
                                render={
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={t("common.settings")}
                                    />
                                }
                            />
                        }
                    >
                        <SettingsIcon />
                    </TooltipTrigger>
                </AnimateIcon>
                <TooltipContent>{t("common.settings")}</TooltipContent>
            </Tooltip>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t("providers.settingsTitle")}</DialogTitle>
                </DialogHeader>
                <FieldGroup>
                    <Field>
                        <FieldLabel htmlFor="provider-settings-identifier">
                            {t("providers.identifier")}
                        </FieldLabel>
                        <Input
                            id="provider-settings-identifier"
                            value={provider.identifier}
                            readOnly
                            disabled
                        />
                        <FieldDescription>
                            {t("providers.identifierHint")}
                        </FieldDescription>
                    </Field>
                    <Field>
                        <FieldLabel htmlFor="provider-settings-name">
                            {t("providers.name")}
                        </FieldLabel>
                        <Input
                            id="provider-settings-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t("providers.namePlaceholder")}
                        />
                        <FieldDescription>
                            {t("providers.nameDesc")}
                        </FieldDescription>
                    </Field>
                    {error !== null && <FieldError>{error}</FieldError>}
                </FieldGroup>
                <DialogFooter>
                    <DialogClose render={<Button variant="outline" />}>
                        {t("common.cancel")}
                    </DialogClose>
                    <Button
                        type="button"
                        disabled={busy || nextName === provider.name}
                        onClick={() => void save()}
                    >
                        {t("common.save")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
