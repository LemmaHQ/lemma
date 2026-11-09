import {
    Button,
    Field,
    FieldGroup,
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
    LockIcon,
    PasswordInput,
    Reveal,
    toast,
    UserIcon,
} from "@lemma/ui";
import { useState, type SubmitEvent } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import { useAuth } from "../store";

/** Which of the two sign-in steps the form shows. */
export type SignInStep = "account" | "password";

/**
 * Two-step sign-in: the account first, then its password. The parent owns
 * `step`; an account that does not exist goes to `onUnknownAccount` with the
 * trimmed input.
 */
export function SignInForm({
    step,
    onStepChange,
    onUnknownAccount,
}: {
    step: SignInStep;
    onStepChange: (step: SignInStep) => void;
    onUnknownAccount: (identifier: string) => void;
}) {
    const { t } = useTranslation();
    const signIn = useAuth((s) => s.signIn);
    const checkAccount = useAuth((s) => s.checkAccount);
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [invalid, setInvalid] = useState(false);
    const [busy, setBusy] = useState(false);
    const [stepChanged, setStepChanged] = useState(false);
    const focusOnMount = stepChanged
        ? (el: HTMLInputElement | null) => el?.focus({ preventScroll: true })
        : undefined;

    const submit = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        const account = identifier.trim();
        setBusy(true);
        setInvalid(false);
        try {
            if (step === "account") {
                if (await checkAccount(account)) {
                    onStepChange("password");
                    setStepChanged(true);
                } else {
                    onUnknownAccount(account);
                }
            } else {
                await signIn(account, password);
            }
        } catch (e) {
            setInvalid(true);
            toast.error(errorText(e, t));
        } finally {
            setBusy(false);
        }
    };

    const changeAccount = () => {
        onStepChange("account");
        setStepChanged(true);
        setPassword("");
        setInvalid(false);
    };

    return (
        <form
            onSubmit={(event) => {
                void submit(event);
            }}
        >
            <FieldGroup>
                <div className="flex flex-col">
                    {step === "account" ? (
                        <Field data-invalid={invalid}>
                            <InputGroup>
                                <InputGroupAddon>
                                    <UserIcon />
                                </InputGroupAddon>
                                <InputGroupInput
                                    name="username"
                                    autoComplete="username"
                                    ref={focusOnMount}
                                    required
                                    aria-label={t("auth.identifier")}
                                    placeholder={t("auth.identifier")}
                                    aria-invalid={invalid}
                                    value={identifier}
                                    onChange={(e) => {
                                        setIdentifier(e.target.value);
                                        setInvalid(false);
                                    }}
                                />
                            </InputGroup>
                        </Field>
                    ) : (
                        <Field>
                            <input
                                className="sr-only"
                                type="text"
                                name="username"
                                autoComplete="username"
                                tabIndex={-1}
                                aria-hidden
                                readOnly
                                value={identifier.trim()}
                            />
                            <InputGroup>
                                <InputGroupAddon>
                                    <UserIcon />
                                </InputGroupAddon>
                                <span className="min-w-0 flex-1 truncate pl-1.5 text-reading font-medium md:text-body">
                                    {identifier.trim()}
                                </span>
                                <InputGroupAddon align="inline-end">
                                    <InputGroupButton onClick={changeAccount}>
                                        {t("auth.changeAccount")}
                                    </InputGroupButton>
                                </InputGroupAddon>
                            </InputGroup>
                        </Field>
                    )}
                    <Reveal open={step === "password"}>
                        <div className="pt-5">
                            <Field data-invalid={invalid}>
                                <PasswordInput
                                    showLabel={t("passwordInput.show")}
                                    hideLabel={t("passwordInput.hide")}
                                    name="password"
                                    autoComplete="current-password"
                                    ref={focusOnMount}
                                    required
                                    aria-label={t("auth.password")}
                                    placeholder={t("auth.password")}
                                    aria-invalid={invalid}
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        setInvalid(false);
                                    }}
                                >
                                    <InputGroupAddon>
                                        <LockIcon />
                                    </InputGroupAddon>
                                </PasswordInput>
                            </Field>
                        </div>
                    </Reveal>
                </div>
                <Button type="submit" size="lg" loading={busy}>
                    {step === "account" ? t("auth.continue") : t("auth.signIn")}
                </Button>
            </FieldGroup>
        </form>
    );
}
