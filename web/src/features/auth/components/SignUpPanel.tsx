import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";

import { readSignUpPrefill } from "../sign-up-prefill";
import { AuthPanel } from "./AuthPanel";
import { SignUpForm } from "./SignUpForm";

/** Sign-up in its panel, prefilled from the account sign-in did not find; links back to `signInPath`. */
export function SignUpPanel({ signInPath }: { signInPath: string }) {
    const { t } = useTranslation();
    const location = useLocation();

    return (
        <AuthPanel
            title={t("auth.signUpTitle")}
            description={t("auth.signUpDescription")}
            switchPrompt={t("auth.haveAccount")}
            switchLabel={t("auth.signIn")}
            switchTo={signInPath}
        >
            <SignUpForm prefill={readSignUpPrefill(location.state)} />
        </AuthPanel>
    );
}
