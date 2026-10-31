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
    AnimateIcon,
    Button,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    Trash2Icon,
} from "@lemma/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";

/** Icon button that deletes a provider after a confirmation dialog. */
export function DeleteProviderButton({ onDelete }: { onDelete: () => void }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
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
                    <AlertDialogAction
                        variant="destructive"
                        onClick={() => {
                            setOpen(false);
                            onDelete();
                        }}
                    >
                        {t("common.delete")}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
