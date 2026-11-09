import { LemmaLogo } from "@lemma/ui";
import { useTranslation } from "react-i18next";

export function SplashScreen() {
    const { t } = useTranslation();
    return (
        <output
            aria-label={t("common.loading")}
            className="grid min-h-dvh place-items-center"
        >
            <div className="flex items-center gap-3 motion-safe:animate-pulse">
                <LemmaLogo className="size-10" />
                <span className="text-body font-semibold">Lemma</span>
            </div>
        </output>
    );
}
