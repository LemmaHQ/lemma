import {
    Button,
    Field,
    FieldGroup,
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    LockIcon,
    MailIcon,
    PasswordInput,
    toast,
    UserIcon,
} from "@lemma/ui";
import { useState, type SubmitEvent } from "react";
import { useTranslation } from "react-i18next";

import { errorText } from "@/i18n/error-text";

import type { SignUpPrefill } from "../sign-up-prefill";
import { takenSignUpField, useAuth } from "../store";

type SignUpField = "username" | "email" | "confirm";

/** Sign-up with username, email, and a confirmed password. */
export function SignUpForm({ prefill }: { prefill: SignUpPrefill }) {
    const { t } = useTranslation();
    const signUp = useAuth((s) => s.signUp);
    const [username, setUsername] = useState(prefill.username ?? "");
    const [email, setEmail] = useState(prefill.email ?? "");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [invalidField, setInvalidField] = useState<SignUpField | null>(null);
    const [busy, setBusy] = useState(false);

    const submit = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (password !== confirm) {
            setInvalidField("confirm");
            toast.error(t("auth.passwordMismatch"));
            return;
        }
        setBusy(true);
        setInvalidField(null);
        try {
            await signUp(username.trim(), email.trim(), password);
        } catch (e) {
            setInvalidField(takenSignUpField(e));
            toast.error(errorText(e, t));
        } finally {
            setBusy(false);
        }
    };

    const clearInvalid = (field: SignUpField) => {
        if (invalidField === field) {
            setInvalidField(null);
        }
    };
    const usernameInvalid = invalidField === "username";
    const emailInvalid = invalidField === "email";
    const confirmInvalid = invalidField === "confirm";

    return (
        <form
            onSubmit={(event) => {
                void submit(event);
            }}
        >
            <FieldGroup>
                <Field data-invalid={usernameInvalid}>
                    <InputGroup>
                        <InputGroupAddon>
                            <UserIcon />
                        </InputGroupAddon>
                        <InputGroupInput
                            name="username"
                            autoComplete="username"
                            required
                            aria-label={t("auth.username")}
                            placeholder={t("auth.username")}
                            aria-invalid={usernameInvalid}
                            value={username}
                            onChange={(e) => {
                                setUsername(e.target.value);
                                clearInvalid("username");
                            }}
                        />
                    </InputGroup>
                </Field>
                <Field data-invalid={emailInvalid}>
                    <InputGroup>
                        <InputGroupAddon>
                            <MailIcon />
                        </InputGroupAddon>
                        <InputGroupInput
                            type="email"
                            name="email"
                            autoComplete="email"
                            required
                            aria-label={t("auth.email")}
                            placeholder={t("auth.email")}
                            aria-invalid={emailInvalid}
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                clearInvalid("email");
                            }}
                        />
                    </InputGroup>
                </Field>
                <Field>
                    <PasswordInput
                        showLabel={t("passwordInput.show")}
                        hideLabel={t("passwordInput.hide")}
                        name="password"
                        autoComplete="new-password"
                        required
                        aria-label={t("auth.password")}
                        placeholder={t("auth.password")}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    >
                        <InputGroupAddon>
                            <LockIcon />
                        </InputGroupAddon>
                    </PasswordInput>
                </Field>
                <Field data-invalid={confirmInvalid}>
                    <PasswordInput
                        showLabel={t("passwordInput.show")}
                        hideLabel={t("passwordInput.hide")}
                        name="confirm-password"
                        autoComplete="new-password"
                        required
                        aria-label={t("auth.confirmPassword")}
                        placeholder={t("auth.confirmPassword")}
                        aria-invalid={confirmInvalid}
                        value={confirm}
                        onChange={(e) => {
                            setConfirm(e.target.value);
                            clearInvalid("confirm");
                        }}
                    >
                        <InputGroupAddon>
                            <LockIcon />
                        </InputGroupAddon>
                    </PasswordInput>
                </Field>
                <Button type="submit" size="lg" loading={busy}>
                    {t("auth.signUp")}
                </Button>
            </FieldGroup>
        </form>
    );
}
