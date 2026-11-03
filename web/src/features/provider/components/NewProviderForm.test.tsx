import { Code, ConnectError } from "@connectrpc/connect";
import { render, screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { type NewProviderData, NewProviderForm } from "./NewProviderForm";

const renderForm = (
    onSave = vi.fn<(data: NewProviderData) => Promise<void>>(() =>
        Promise.resolve(),
    ),
    onCancel = vi.fn<() => void>(),
) => {
    render(<NewProviderForm onSave={onSave} onCancel={onCancel} />);
    return { onSave, onCancel };
};

const heading = () => screen.getByRole("heading").textContent;

const fill = (
    user: UserEvent,
    fields: Partial<
        Record<"Provider ID" | "Provider name" | "Base URL", string>
    >,
): Promise<void> =>
    Object.entries(fields).reduce(
        (typed, [label, value]) =>
            typed.then(() => user.type(screen.getByLabelText(label), value)),
        Promise.resolve(),
    );

const save = (user: UserEvent) =>
    user.click(screen.getByRole("button", { name: "Save" }));

it("titles the page by name, then by ID, then as a new provider", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(heading()).toBe("New provider");
    expect(screen.getByText("?")).toBeDefined();
    await fill(user, { "Provider ID": "corp" });
    expect(heading()).toBe("corp");
    await fill(user, { "Provider name": "Corp AI" });
    expect(heading()).toBe("Corp AI");
});

it("creates an OpenAI provider named after its ID by default", async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm();

    await fill(user, {
        "Provider ID": " corp ",
        "Base URL": " https://api.corp.dev/v1 ",
    });
    await save(user);

    expect(onSave).toHaveBeenCalledWith({
        kind: "openai",
        identifier: "corp",
        name: "corp",
        apiKey: "",
        baseUrl: "https://api.corp.dev/v1",
        apiPath: "",
    });
});

it("creates a Gemini provider with its own name and path", async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm();

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "gemini" }));
    expect(
        screen.getByText(/\{model\} is replaced by the model ID/u),
    ).toBeDefined();
    await fill(user, {
        "Provider ID": "g",
        "Provider name": " Google ",
        "Base URL": "https://generativelanguage.googleapis.com",
    });
    await user.type(screen.getByLabelText("API key"), " key ");
    await user.type(screen.getByLabelText("Request path"), " /v1/models ");
    await save(user);

    expect(onSave).toHaveBeenCalledWith({
        kind: "gemini",
        identifier: "g",
        name: "Google",
        apiKey: "key",
        baseUrl: "https://generativelanguage.googleapis.com",
        apiPath: "/v1/models",
    });
});

it.each([
    [
        "an empty ID",
        {},
        "Provider ID must be non-empty and contain only ASCII characters.",
    ],
    [
        "a non-ASCII ID",
        { "Provider ID": "供应商" },
        "Provider ID must be non-empty and contain only ASCII characters.",
    ],
    ["no base URL", { "Provider ID": "corp" }, "Base URL is required"],
])("refuses to save with %s", async (_case, fields, message) => {
    const user = userEvent.setup();
    const { onSave } = renderForm();

    await fill(user, fields);
    await save(user);

    expect(screen.getByRole("alert").textContent).toBe(message);
    expect(onSave).not.toHaveBeenCalled();
});

it("blocks saving a malformed base URL", async () => {
    const user = userEvent.setup();
    renderForm();

    await fill(user, { "Base URL": "api.corp.dev" });

    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty(
        "disabled",
        true,
    );
});

it("shows why the provider could not be created", async () => {
    const user = userEvent.setup();
    renderForm(
        vi.fn<(data: NewProviderData) => Promise<void>>(() =>
            Promise.reject(new ConnectError("down", Code.Unavailable)),
        ),
    );

    await fill(user, { "Provider ID": "corp", "Base URL": "https://a.dev" });
    await save(user);

    expect((await screen.findByRole("alert")).textContent).toBe(
        "Can't reach the server, check your connection and try again",
    );
    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty(
        "disabled",
        false,
    );
});

it("cancels creating", async () => {
    const user = userEvent.setup();
    const { onCancel } = renderForm();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledOnce();
});
