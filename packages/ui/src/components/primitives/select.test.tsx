import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./select";

const kinds = [
    { value: "openai", label: "OpenAI" },
    { value: "anthropic", label: "Anthropic" },
];

it("shows the chosen item and reports a new choice", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn<(value: string | null) => void>();
    render(
        <Select
            items={kinds}
            defaultValue="openai"
            onValueChange={onValueChange}
        >
            <SelectTrigger aria-label="Kind" size="sm">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {kinds.map((kind) => (
                    <SelectItem key={kind.value} value={kind.value}>
                        {kind.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>,
    );
    const trigger = screen.getByRole("combobox", { name: "Kind" });
    expect(trigger.textContent).toBe("OpenAI");

    await user.click(trigger);
    await user.click(await screen.findByRole("option", { name: "Anthropic" }));

    expect(onValueChange.mock.calls[0]?.[0]).toBe("anthropic");
    expect(trigger.textContent).toBe("Anthropic");
});
