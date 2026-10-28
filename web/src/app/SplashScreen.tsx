import { useTranslation } from "react-i18next";

export function SplashScreen() {
    const { t } = useTranslation();
    return (
        <output
            aria-label={t("common.loading")}
            className="grid min-h-dvh place-items-center"
        >
            <span className="font-serif text-xl font-semibold text-muted-foreground motion-safe:animate-pulse">
                Lemma
            </span>
        </output>
    );
}
