import { Button } from "@lemma/ui/components/button";
import { Field, FieldGroup } from "@lemma/ui/components/field";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from "@lemma/ui/components/input-group";
import { PasswordInput } from "@lemma/ui/components/password-input";
import { LockIcon } from "@lemma/ui/icons/lock";
import { UserIcon } from "@lemma/ui/icons/user";
import { useState, type SubmitEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { authClient } from "@/data/rpc/clients";
import { errorText } from "@/data/rpc/errors";

import { useAuth } from "./store";

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
    onUnknownAccount: (login: string) => void;
}) {
    const { t } = useTranslation();
    const login = useAuth((s) => s.login);
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [invalid, setInvalid] = useState(false);
    const [busy, setBusy] = useState(false);
    const [stepChanged, setStepChanged] = useState(false);
    const focusOnMount = stepChanged
        ? (el: HTMLInputElement | null) => el?.focus()
        : undefined;

    const submit = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        const account = identifier.trim();
        setBusy(true);
        setInvalid(false);
        try {
            if (step === "account") {
                const res = await authClient.checkAccount({ login: account });
                if (res.exists) {
                    onStepChange("password");
                    setStepChanged(true);
                } else {
                    onUnknownAccount(account);
                }
            } else {
                await login(account, password);
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
                    <>
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
                                <span className="min-w-0 flex-1 truncate pl-1.5 text-base font-medium md:text-sm">
                                    {identifier.trim()}
                                </span>
                                <InputGroupAddon align="inline-end">
                                    <InputGroupButton onClick={changeAccount}>
                                        {t("auth.changeAccount")}
                                    </InputGroupButton>
                                </InputGroupAddon>
                            </InputGroup>
                        </Field>
                        <Field
                            data-invalid={invalid}
                            className="animate-in duration-slow ease-enter fade-in-0 slide-in-from-bottom-1"
                        >
                            <PasswordInput
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
                    </>
                )}
                <Button type="submit" size="lg" loading={busy}>
                    {step === "account" ? t("auth.continue") : t("auth.signIn")}
                </Button>
            </FieldGroup>
        </form>
    );
}
