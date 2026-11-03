import { Code, ConnectError } from "@connectrpc/connect";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { ConnectionCheck } from "./ConnectionCheck";

type Props = Parameters<typeof ConnectionCheck>[0];

const props = (patch: Partial<Props> = {}): Props => ({
    models: ["m1", "m2"],
    target: "key\nurl\npath",
    disabled: false,
    onCheck: () => Promise.resolve(""),
    ...patch,
});

const checkButton = () => screen.getByRole("button", { name: "Check" });

it("reports that the first model answered", async () => {
    const user = userEvent.setup();
    const onCheck = vi.fn<(model: string) => Promise<string>>(() =>
        Promise.resolve(""),
    );
    render(<ConnectionCheck {...props({ onCheck })} />);

    await user.click(checkButton());

    expect(await screen.findByText("The provider answered.")).toBeDefined();
    expect(onCheck).toHaveBeenCalledWith("m1");
});

it("checks the picked model and shows the upstream failure", async () => {
    const user = userEvent.setup();
    const onCheck = vi.fn<(model: string) => Promise<string>>(() =>
        Promise.resolve("401 invalid key"),
    );
    render(<ConnectionCheck {...props({ onCheck })} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "m2" }));
    await user.click(checkButton());

    expect(await screen.findByText("401 invalid key")).toBeDefined();
    expect(onCheck).toHaveBeenCalledWith("m2");
});

it("shows a request failure as the check result", async () => {
    const user = userEvent.setup();
    render(
        <ConnectionCheck
            {...props({
                onCheck: () =>
                    Promise.reject(new ConnectError("down", Code.Unavailable)),
            })}
        />,
    );

    await user.click(checkButton());

    expect(
        await screen.findByText(
            "Can't reach the server, check your connection and try again",
        ),
    ).toBeDefined();
});

it("drops a result once the connection settings change", async () => {
    const user = userEvent.setup();
    const answer = Promise.withResolvers<string>();
    const { rerender } = render(
        <ConnectionCheck {...props({ onCheck: () => answer.promise })} />,
    );

    await user.click(checkButton());
    expect(checkButton().getAttribute("aria-busy")).toBe("true");
    rerender(
        <ConnectionCheck
            {...props({ target: "other", onCheck: () => answer.promise })}
        />,
    );
    answer.resolve("");
    await answer.promise;

    expect(screen.queryByText("The provider answered.")).toBeNull();
    expect(
        screen.getByText(
            "Sends a short request with the selected model to confirm the provider answers.",
        ),
    ).toBeDefined();
});

it("falls back to the first model when the picked one is removed", async () => {
    const user = userEvent.setup();
    const onCheck = vi.fn<(model: string) => Promise<string>>(() =>
        Promise.resolve(""),
    );
    const { rerender } = render(<ConnectionCheck {...props({ onCheck })} />);
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "m2" }));

    rerender(<ConnectionCheck {...props({ models: ["m1"], onCheck })} />);
    await user.click(checkButton());

    expect(onCheck).toHaveBeenCalledWith("m1");
});

it("keeps the newer check when an older one finishes late", async () => {
    const user = userEvent.setup();
    const first = Promise.withResolvers<string>();
    const onCheck = vi
        .fn<(model: string) => Promise<string>>()
        .mockReturnValueOnce(first.promise)
        .mockResolvedValueOnce("");
    render(<ConnectionCheck {...props({ onCheck })} />);

    await user.click(checkButton());
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "m2" }));
    await user.click(checkButton());
    await screen.findByText("The provider answered.");
    await act(async () => {
        first.resolve("timeout");
        await first.promise;
    });

    expect(screen.getByText("The provider answered.")).toBeDefined();
    expect(screen.queryByText("timeout")).toBeNull();
});

it("cannot check without a model or a valid connection", () => {
    const { rerender } = render(<ConnectionCheck {...props({ models: [] })} />);

    expect(screen.getByText("Add a model first")).toBeDefined();
    expect(checkButton()).toHaveProperty("disabled", true);
    rerender(<ConnectionCheck {...props({ disabled: true })} />);
    expect(checkButton()).toHaveProperty("disabled", true);
});
