import { Wordmark } from "@lemma/ui";
import { useTranslation } from "react-i18next";

/** Shown while the router hydrates; its 24px wordmark matches the boot markup in `index.html`. */
export function SplashScreen() {
    const { t } = useTranslation();
    return (
        <output
            aria-label={t("common.loading")}
            className="grid min-h-dvh place-items-center"
        >
            <Wordmark size="splash" label={t("common.appName")} />
        </output>
    );
}
