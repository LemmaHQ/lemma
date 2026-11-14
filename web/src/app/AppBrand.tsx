import { Wordmark } from "@lemma/ui";
import { useTranslation } from "react-i18next";

/** The product name in the brand serif with the brand-blue dot; `large` matches the splash boot markup in `index.html`. */
export function AppBrand({ large = false }: { large?: boolean }) {
    const { t } = useTranslation();
    if (!large) {
        return <Wordmark label={t("common.appName")} />;
    }
    return (
        <span className="font-brand text-display font-normal">
            {t("common.appName")}
            <span
                aria-hidden="true"
                className="relative bottom-3 ml-0.5 inline-block size-1.5 rounded-full bg-brand"
            />
        </span>
    );
}
