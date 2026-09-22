import en from "./locales/en.json";

// Key checking is driven off the en source locale; zh parity is enforced by
// i18n-ally's progress view and the missing-key annotations.
declare module "i18next" {
    interface CustomTypeOptions {
        defaultNS: "translation";
        resources: {
            translation: typeof en;
        };
    }
}
