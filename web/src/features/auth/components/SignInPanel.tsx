import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { prefillFromIdentifier } from "../sign-up-prefill";
import { AuthPanel } from "./AuthPanel";
import { SignInForm, type SignInStep } from "./SignInForm";

/** Two-step sign-in in its panel; an unknown account continues at `signUpPath` with the account prefilled. */
export function SignInPanel({ signUpPath }: { signUpPath: string }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [step, setStep] = useState<SignInStep>("account");
    const password = step === "password";

    return (
        <AuthPanel
            title={password ? t("auth.passwordTitle") : t("auth.signInTitle")}
            description={
                password
                    ? t("auth.passwordDescription")
                    : t("auth.signInDescription")
            }
            switchPrompt={t("auth.noAccount")}
            switchLabel={t("auth.signUp")}
            switchTo={signUpPath}
        >
            <SignInForm
                step={step}
                onStepChange={setStep}
                onUnknownAccount={(identifier) => {
                    void navigate(signUpPath, {
                        state: prefillFromIdentifier(identifier),
                        viewTransition: true,
                    });
                }}
            />
        </AuthPanel>
    );
}
