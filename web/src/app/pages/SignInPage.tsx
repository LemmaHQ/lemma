import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { AuthPanel } from "@/app/auth/AuthPanel";
import { SignInForm, type SignInStep } from "@/features/auth/SignInForm";
import type { SignUpPrefill } from "@/features/auth/SignUpForm";

export function SignInPage() {
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
            switchTo="/signup"
        >
            <SignInForm
                step={step}
                onStepChange={setStep}
                onUnknownAccount={(login) => {
                    const prefill: SignUpPrefill = login.includes("@")
                        ? { email: login }
                        : { username: login };
                    void navigate("/signup", {
                        state: prefill,
                        viewTransition: true,
                    });
                }}
            />
        </AuthPanel>
    );
}
