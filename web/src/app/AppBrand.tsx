import { Wordmark } from "@lemma/ui";
import { useTranslation } from "react-i18next";

/** The product name in the 19px sidebar brand serif with the brand-blue dot. */
export function AppBrand() {
    const { t } = useTranslation();
    return <Wordmark label={t("common.appName")} />;
}
