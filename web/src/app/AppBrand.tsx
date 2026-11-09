import { cn } from "@lemma/ui";
import { useTranslation } from "react-i18next";

/** The product name in the brand serif with the brand-blue dot at its top right; `large` is the splash size, which `index.html` repeats for the first paint. */
export function AppBrand({ large = false }: { large?: boolean }) {
    const { t } = useTranslation();
    return (
        <span
            className={cn(
                "font-brand font-normal",
                large ? "text-display" : "text-title",
            )}
        >
            {t("common.appName")}
            <span
                aria-hidden="true"
                className={cn(
                    "relative ml-0.5 inline-block rounded-full bg-brand",
                    large ? "bottom-3 size-1.5" : "bottom-2 size-1",
                )}
            />
        </span>
    );
}
