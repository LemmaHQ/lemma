import { AnimateIcon } from "@animate-ui/react/icons";
import { Button } from "@lemma/ui/components/button";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@lemma/ui/components/tooltip";
import { Trash2Icon } from "@lemma/ui/icons/trash-2";
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
} from "@lemma/ui/components/alert-dialog";

/** Icon button that deletes a provider after a confirmation dialog. */
export function DeleteProviderButton({ onDelete }: { onDelete: () => void }) {
    const { t } = useTranslation();

    return (
        <AlertDialog>
            <Tooltip>
                <AnimateIcon animateOnHover asChild>
                    <TooltipTrigger
                        render={
                            <AlertDialogTrigger
                                render={
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={t(
                                            "providers.deleteProvider",
                                        )}
                                    />
                                }
                            />
                        }
                    >
                        <Trash2Icon />
                    </TooltipTrigger>
                </AnimateIcon>
                <TooltipContent>{t("providers.deleteProvider")}</TooltipContent>
            </Tooltip>
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
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={onDelete}>
                        {t("common.delete")}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
