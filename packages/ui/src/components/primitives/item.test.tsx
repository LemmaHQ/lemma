import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";

import { Button } from "./button";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemSeparator,
    ItemTitle,
} from "./item";
import { Skeleton } from "./skeleton";

it("lists items as list entries, rendering one as a link", () => {
    render(
        <ItemGroup>
            <Item role="listitem" variant="outline" size="sm">
                <ItemContent>
                    <ItemTitle>Acme</ItemTitle>
                    <ItemDescription>3 models</ItemDescription>
                </ItemContent>
                <ItemActions>
                    <Button>Edit</Button>
                </ItemActions>
            </Item>
            <ItemSeparator />
            <Item
                role="listitem"
                render={({ children, ...props }) => (
                    <a href="/beta" {...props}>
                        {children}
                    </a>
                )}
            >
                <ItemTitle>Beta</ItemTitle>
            </Item>
            <Item role="listitem">
                <Skeleton shape="circle" aria-label="Loading" />
            </Item>
        </ItemGroup>,
    );

    const entries = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(entries.map((entry) => entry.textContent)).toEqual([
        "Acme3 modelsEdit",
        "Beta",
        "",
    ]);
    expect(entries[1]?.tagName).toBe("A");
    expect(screen.getByRole("separator")).toBeDefined();
    expect(screen.getByLabelText("Loading")).toBeDefined();
});
