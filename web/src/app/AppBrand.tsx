import { LemmaLogo, cn } from "@lemma/ui";
import { useTranslation } from "react-i18next";

/** The product mark and name in the brand serif; `large` is the splash size, which `index.html` repeats for the first paint. */
export function AppBrand({ large = false }: { large?: boolean }) {
    const { t } = useTranslation();
    return (
        <div className={cn("flex items-center", large ? "gap-3" : "gap-2")}>
            <LemmaLogo className={large ? "size-10" : "size-5"} />
            <span
                className={cn(
                    "font-brand",
                    large
                        ? "text-display font-normal"
                        : "text-title font-normal",
                )}
            >
                {t("common.appName")}
            </span>
        </div>
    );
}
