import { useTranslation } from "react-i18next";

import { AppBrand } from "./AppBrand";

/** Shown while the router hydrates; it matches the boot markup in `index.html`, so the first paint and this screen look the same. */
export function SplashScreen() {
    const { t } = useTranslation();
    return (
        <output
            aria-label={t("common.loading")}
            className="grid min-h-dvh place-items-center"
        >
            <AppBrand large />
        </output>
    );
}
