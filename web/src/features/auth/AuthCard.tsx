import { useState, type SubmitEvent } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorText } from "@/data/rpc/errors";
import { useAuth } from "@/features/auth/store";
import { usePlatformAuth } from "@/platform";

export function AuthCard() {
    const { t } = useTranslation();
    const login = useAuth((s) => s.login);
    const signup = useAuth((s) => s.signup);
    const platformAuth = usePlatformAuth();
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const handleLogin = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
            await login(identifier.trim(), password);
        } catch (e) {
            setError(errorText(e, t));
        } finally {
            setBusy(false);
        }
    };

    const handleSignup = async (event: SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (password !== confirm) {
            setError(t("auth.passwordMismatch"));
            return;
        }
        setBusy(true);
        setError("");
        try {
            await signup(username.trim(), email.trim(), password);
        } catch (e) {
            setError(errorText(e, t));
        } finally {
            setBusy(false);
        }
    };

    const handleSkip = async () => {
        const skip = await platformAuth.getSkipCredentials();
        if (skip === null) {
            return;
        }
        setBusy(true);
        setError("");
        try {
            await login(skip.username, skip.password);
        } catch (e) {
            setError(errorText(e, t));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card className="w-full max-w-sm">
            <CardHeader className="text-center">
                <CardTitle>{t("auth.productName")}</CardTitle>
                <CardDescription>{t("auth.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="login">
                    <TabsList className="w-full">
                        <TabsTrigger value="login">
                            {t("auth.loginTab")}
                        </TabsTrigger>
                        <TabsTrigger value="register">
                            {t("auth.registerTab")}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="login">
                        <form
                            onSubmit={(event) => {
                                void handleLogin(event);
                            }}
                        >
                            <FieldGroup>
                                <Field>
                                    <FieldLabel htmlFor="login-identifier">
                                        {t("auth.identifier")}
                                    </FieldLabel>
                                    <Input
                                        id="login-identifier"
                                        type="text"
                                        autoComplete="username"
                                        placeholder={t(
                                            "auth.identifierPlaceholder",
                                        )}
                                        value={identifier}
                                        onChange={(e) =>
                                            setIdentifier(e.target.value)
                                        }
                                        required
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="login-password">
                                        {t("auth.password")}
                                    </FieldLabel>
                                    <Input
                                        id="login-password"
                                        type="password"
                                        autoComplete="current-password"
                                        placeholder={t(
                                            "auth.passwordPlaceholder",
                                        )}
                                        value={password}
                                        onChange={(e) =>
                                            setPassword(e.target.value)
                                        }
                                        required
                                    />
                                </Field>
                                {error !== "" && (
                                    <FieldError>{error}</FieldError>
                                )}
                                <Field>
                                    <Button type="submit" disabled={busy}>
                                        {t("auth.signIn")}
                                    </Button>
                                </Field>
                            </FieldGroup>
                        </form>
                    </TabsContent>

                    <TabsContent value="register">
                        <form
                            onSubmit={(event) => {
                                void handleSignup(event);
                            }}
                        >
                            <FieldGroup>
                                <Field>
                                    <FieldLabel htmlFor="register-username">
                                        {t("auth.username")}
                                    </FieldLabel>
                                    <Input
                                        id="register-username"
                                        type="text"
                                        autoComplete="username"
                                        placeholder={t(
                                            "auth.usernamePlaceholder",
                                        )}
                                        value={username}
                                        onChange={(e) =>
                                            setUsername(e.target.value)
                                        }
                                        required
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="register-email">
                                        {t("auth.email")}
                                    </FieldLabel>
                                    <Input
                                        id="register-email"
                                        type="email"
                                        autoComplete="email"
                                        placeholder={t("auth.emailPlaceholder")}
                                        value={email}
                                        onChange={(e) =>
                                            setEmail(e.target.value)
                                        }
                                        required
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="register-password">
                                        {t("auth.password")}
                                    </FieldLabel>
                                    <Input
                                        id="register-password"
                                        type="password"
                                        autoComplete="new-password"
                                        placeholder={t(
                                            "auth.passwordPlaceholder",
                                        )}
                                        value={password}
                                        onChange={(e) =>
                                            setPassword(e.target.value)
                                        }
                                        required
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="register-confirm">
                                        {t("auth.confirmPassword")}
                                    </FieldLabel>
                                    <Input
                                        id="register-confirm"
                                        type="password"
                                        autoComplete="new-password"
                                        placeholder={t(
                                            "auth.confirmPasswordPlaceholder",
                                        )}
                                        value={confirm}
                                        onChange={(e) =>
                                            setConfirm(e.target.value)
                                        }
                                        required
                                    />
                                </Field>
                                {error !== "" && (
                                    <FieldError>{error}</FieldError>
                                )}
                                <Field>
                                    <Button type="submit" disabled={busy}>
                                        {t("auth.createAccount")}
                                    </Button>
                                </Field>
                            </FieldGroup>
                        </form>
                    </TabsContent>
                </Tabs>
                {platformAuth.canSkipAuth && (
                    <FieldGroup className="pt-6">
                        <FieldSeparator>{t("auth.orDivider")}</FieldSeparator>
                        <Field>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={busy}
                                onClick={() => {
                                    void handleSkip();
                                }}
                            >
                                {t("auth.skipDesktop")}
                            </Button>
                        </Field>
                    </FieldGroup>
                )}
            </CardContent>
        </Card>
    );
}
