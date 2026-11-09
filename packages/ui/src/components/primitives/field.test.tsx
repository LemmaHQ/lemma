import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { Checkbox } from "./checkbox";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "./field";
import { Input } from "./input";
import { Separator } from "./separator";
import { Switch } from "./switch";
import { Textarea } from "./textarea";

it("names its controls by their labels and reports errors", async () => {
    const user = userEvent.setup();
    render(
        <FieldGroup>
            <Field data-invalid>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input id="name" aria-invalid />
                <FieldError>Name is taken</FieldError>
            </Field>
            <Separator />
            <Field>
                <FieldLabel htmlFor="notes">Notes</FieldLabel>
                <Textarea id="notes" />
                <FieldDescription>Shown to you only.</FieldDescription>
            </Field>
        </FieldGroup>,
    );

    await user.type(screen.getByRole("textbox", { name: "Name" }), "Acme");
    await user.type(screen.getByRole("textbox", { name: "Notes" }), "Hi");

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveProperty(
        "value",
        "Acme",
    );
    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveProperty(
        "value",
        "Hi",
    );
    expect(screen.getByRole("alert").textContent).toBe("Name is taken");
    expect(screen.getByRole("separator")).toBeDefined();
});

it("toggles labeled checkboxes and switches", async () => {
    const user = userEvent.setup();
    render(
        <>
            <Field orientation="horizontal">
                <Checkbox id="agree" />
                <FieldContent>
                    <FieldLabel htmlFor="agree">Agree</FieldLabel>
                </FieldContent>
            </Field>
            <Field orientation="horizontal">
                <FieldLabel htmlFor="enabled">Enabled</FieldLabel>
                <Switch id="enabled" />
            </Field>
        </>,
    );
    const checkbox = screen.getByRole("checkbox", { name: "Agree" });
    const toggle = screen.getByRole("switch", { name: "Enabled" });

    await user.click(checkbox);
    await user.click(toggle);

    expect(checkbox.getAttribute("aria-checked")).toBe("true");
    expect(toggle.getAttribute("aria-checked")).toBe("true");
});
