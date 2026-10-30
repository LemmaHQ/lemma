import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";

import { AuthPanel, SignUpForm, type SignUpPrefill } from "@/features/auth";

function readPrefill(state: unknown): SignUpPrefill {
    if (typeof state !== "object" || state === null) {
        return {};
    }
    if ("username" in state && typeof state.username === "string") {
        return { username: state.username };
    }
    if ("email" in state && typeof state.email === "string") {
        return { email: state.email };
    }
    return {};
}

export function SignUpPage() {
    const { t } = useTranslation();
    const location = useLocation();

    return (
        <AuthPanel
            title={t("auth.signUpTitle")}
            description={t("auth.signUpDescription")}
            switchPrompt={t("auth.haveAccount")}
            switchLabel={t("auth.signIn")}
            switchTo="/signin"
        >
            <SignUpForm prefill={readPrefill(location.state)} />
        </AuthPanel>
    );
}
