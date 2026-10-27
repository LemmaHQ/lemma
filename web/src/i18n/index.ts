import uiEn from "@lemma/ui/locales/en.json";
import uiZh from "@lemma/ui/locales/zh.json";
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import zh from "./locales/zh.json";

void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en, ui: uiEn },
            zh: { translation: zh, ui: uiZh },
        },
        fallbackLng: "en",
        interpolation: { escapeValue: false },
        detection: {
            order: ["localStorage", "navigator"],
            caches: ["localStorage"],
            lookupLocalStorage: "lemma.lang",
        },
    });

export { i18n };
