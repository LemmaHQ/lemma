import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { Toaster } from "@lemma/ui";
import { render, screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { AuthTokensSchema, UserSchema } from "@/gen/lemma/v1/auth_pb";
import { ErrorInfoSchema, ErrorReason } from "@/gen/lemma/v1/errors_pb";

import { useAuth } from "../store";
import { SignUpForm } from "./SignUpForm";

const rpc = vi.hoisted(() => ({
    signUp: vi.fn<
        (req: {
            username: string;
            email: string;
            password: string;
        }) => Promise<object>
    >(),
}));

vi.mock("@/platform/platform", () => ({
    getPlatform: () => ({ auth: { cookieMode: false } }),
}));

vi.mock("@/rpc/clients", () => ({ authClient: rpc }));

const field = (name: string) => screen.getByRole("textbox", { name });

const fill = async (
    user: UserEvent,
    values: { password: string; confirm: string },
): Promise<void> => {
    await user.type(screen.getByLabelText("Password"), values.password);
    await user.type(screen.getByLabelText("Confirm password"), values.confirm);
    await user.click(screen.getByRole("button", { name: "Sign up" }));
};

const renderForm = (prefill = {}) =>
    render(
        <>
            <Toaster />
            <SignUpForm prefill={prefill} />
        </>,
    );

beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    useAuth.setState({ user: null });
});

it("creates the account with the trimmed username and email", async () => {
    const user = userEvent.setup();
    rpc.signUp.mockResolvedValue({
        tokens: create(AuthTokensSchema, {
            accessToken: "a",
            refreshToken: "r",
        }),
        user: create(UserSchema, { id: "u1", username: "alice" }),
    });
    renderForm({ username: " alice " });

    await user.type(field("Email"), "a@x.io ");
    await fill(user, { password: "secret", confirm: "secret" });

    await vi.waitFor(() => {
        expect(useAuth.getState().user?.id).toBe("u1");
    });
    expect(rpc.signUp).toHaveBeenCalledWith({
        username: "alice",
        email: "a@x.io",
        password: "secret",
    });
});

it("flags a confirmation that does not match", async () => {
    const user = userEvent.setup();
    renderForm({ username: "alice", email: "a@x.io" });

    await fill(user, { password: "secret", confirm: "secrte" });

    expect(await screen.findByText("Passwords do not match")).toBeDefined();
    const confirm = screen.getByLabelText("Confirm password");
    expect(confirm.getAttribute("aria-invalid")).toBe("true");
    expect(rpc.signUp).not.toHaveBeenCalled();
    await user.type(confirm, "x");
    expect(confirm.getAttribute("aria-invalid")).toBe("false");
});

it.each([
    [ErrorReason.USERNAME_TAKEN, "Username", "This username is already taken"],
    [ErrorReason.EMAIL_TAKEN, "Email", "This email is already registered"],
])(
    "flags the field the server rejected as taken",
    async (reason, name, message) => {
        const user = userEvent.setup();
        rpc.signUp.mockRejectedValue(
            new ConnectError("taken", Code.AlreadyExists, undefined, [
                { desc: ErrorInfoSchema, value: { reason } },
            ]),
        );
        renderForm({ username: "alice", email: "a@x.io" });

        await fill(user, { password: "secret", confirm: "secret" });

        expect(await screen.findByText(message)).toBeDefined();
        expect(field(name).getAttribute("aria-invalid")).toBe("true");
        await user.type(field(name), "2");
        expect(field(name).getAttribute("aria-invalid")).toBe("false");
    },
);

it("keeps a taken username flagged while another field changes", async () => {
    const user = userEvent.setup();
    rpc.signUp.mockRejectedValue(
        new ConnectError("taken", Code.AlreadyExists, undefined, [
            {
                desc: ErrorInfoSchema,
                value: { reason: ErrorReason.USERNAME_TAKEN },
            },
        ]),
    );
    renderForm({ username: "alice", email: "a@x.io" });
    await fill(user, { password: "secret", confirm: "secret" });
    await vi.waitFor(() => {
        expect(field("Username").getAttribute("aria-invalid")).toBe("true");
    });

    await user.type(field("Email"), "m");
    await user.type(screen.getByLabelText("Confirm password"), "x");

    expect(field("Username").getAttribute("aria-invalid")).toBe("true");
});
