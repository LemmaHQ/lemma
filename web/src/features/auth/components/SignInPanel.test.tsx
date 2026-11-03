import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { Toaster } from "@lemma/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";

import { AuthTokensSchema, UserSchema } from "@/gen/lemma/v1/auth_pb";
import { ErrorInfoSchema, ErrorReason } from "@/gen/lemma/v1/errors_pb";

import { useAuth } from "../store";
import { SignInPanel } from "./SignInPanel";
import { SignUpPanel } from "./SignUpPanel";

const rpc = vi.hoisted(() => ({
    checkAccount:
        vi.fn<(req: { identifier: string }) => Promise<{ exists: boolean }>>(),
    signIn: vi.fn<
        (req: { identifier: string; password: string }) => Promise<object>
    >(),
}));

vi.mock("@/platform/platform", () => ({
    getPlatform: () => ({ auth: { cookieMode: false } }),
}));

vi.mock("@/rpc/clients", () => ({ authClient: rpc }));

const renderSignIn = () =>
    render(
        <MemoryRouter initialEntries={["/signin"]}>
            <Toaster />
            <Routes>
                <Route
                    path="/signin"
                    element={<SignInPanel signUpPath="/signup" />}
                />
                <Route
                    path="/signup"
                    element={<SignUpPanel signInPath="/signin" />}
                />
            </Routes>
        </MemoryRouter>,
    );

const accountField = () =>
    screen.getByRole("textbox", { name: "Email or username" });

const passwordField = () => screen.getByLabelText("Password");

beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    useAuth.setState({ user: null });
});

it("asks for the password of a known account, then signs in", async () => {
    const user = userEvent.setup();
    rpc.checkAccount.mockResolvedValue({ exists: true });
    rpc.signIn.mockResolvedValue({
        tokens: create(AuthTokensSchema, {
            accessToken: "a",
            refreshToken: "r",
        }),
        user: create(UserSchema, { id: "u1", username: "alice" }),
    });
    renderSignIn();

    expect(
        screen.getByRole("heading", { name: "Sign in to Lemma" }),
    ).toBeDefined();
    await user.type(accountField(), "  alice ");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(
        await screen.findByRole("heading", { name: "Enter your password" }),
    ).toBeDefined();
    expect(rpc.checkAccount).toHaveBeenCalledWith({ identifier: "alice" });
    expect(document.activeElement).toBe(passwordField());
    await user.type(passwordField(), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await vi.waitFor(() => {
        expect(useAuth.getState().user?.username).toBe("alice");
    });
    expect(rpc.signIn).toHaveBeenCalledWith({
        identifier: "alice",
        password: "secret",
    });
});

it("flags a rejected password and lets the user change the account", async () => {
    const user = userEvent.setup();
    rpc.checkAccount.mockResolvedValue({ exists: true });
    rpc.signIn.mockRejectedValue(
        new ConnectError("bad", Code.Unauthenticated, undefined, [
            {
                desc: ErrorInfoSchema,
                value: { reason: ErrorReason.CREDENTIALS_INVALID },
            },
        ]),
    );
    renderSignIn();
    await user.type(accountField(), "alice");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.type(await screen.findByLabelText("Password"), "wrong");

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
        await screen.findByText("Incorrect username or password"),
    ).toBeDefined();
    expect(passwordField().getAttribute("aria-invalid")).toBe("true");
    await user.type(passwordField(), "!");
    expect(passwordField().getAttribute("aria-invalid")).toBe("false");

    await user.click(screen.getByRole("button", { name: "Change" }));

    expect(
        await screen.findByRole("heading", { name: "Sign in to Lemma" }),
    ).toBeDefined();
    expect(accountField()).toHaveProperty("value", "alice");
    expect(document.activeElement).toBe(accountField());
});

it("flags the account field when the check fails", async () => {
    const user = userEvent.setup();
    rpc.checkAccount.mockRejectedValue(
        new ConnectError("down", Code.Unavailable),
    );
    renderSignIn();

    await user.type(accountField(), "alice");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(
        await screen.findByText(
            "Can't reach the server, check your connection and try again",
        ),
    ).toBeDefined();
    expect(accountField().getAttribute("aria-invalid")).toBe("true");
    await user.type(accountField(), "x");
    expect(accountField().getAttribute("aria-invalid")).toBe("false");
});

it.each([
    ["an email", "new@example.com", "Email"],
    ["a username", "newbie", "Username"],
])(
    "continues an unknown %s at sign-up with it filled in",
    async (_case, identifier, field) => {
        const user = userEvent.setup();
        rpc.checkAccount.mockResolvedValue({ exists: false });
        renderSignIn();

        await user.type(accountField(), identifier);
        await user.click(screen.getByRole("button", { name: "Continue" }));

        expect(
            await screen.findByRole("heading", {
                name: "Create your Lemma account",
            }),
        ).toBeDefined();
        expect(screen.getByRole("textbox", { name: field })).toHaveProperty(
            "value",
            identifier,
        );
        expect(
            screen.getByRole("link", { name: "Sign in" }).getAttribute("href"),
        ).toBe("/signin");
    },
);
