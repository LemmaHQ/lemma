import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { expect, it } from "vitest";

type IconComponent = ComponentType<{
    size?: number;
    "aria-label"?: string;
    animateOnHover?: boolean;
}>;

const isGlyph = (entry: [string, unknown]): entry is [string, IconComponent] =>
    entry[0].endsWith("Icon") && typeof entry[1] === "function";

const iconModules = import.meta.glob<Record<string, unknown>>("./icons/*.tsx", {
    eager: true,
});

const icons = Object.values(iconModules)
    .flatMap((mod: Record<string, unknown>) => Object.entries(mod))
    .filter(isGlyph);

it.each(icons)("%s draws a labeled, sized stroke icon", (name, Icon) => {
    render(<Icon size={20} aria-label={name} />);

    const svg = screen.getByLabelText(name);
    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(svg.getAttribute("width")).toBe("20");
    expect(svg.getAttribute("height")).toBe("20");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.children.length).toBeGreaterThan(0);
});

it.each(icons)("%s keeps its shape while animating", async (name, Icon) => {
    const user = userEvent.setup();
    render(
        <>
            <Icon size={20} aria-label={`${name} static`} />
            <Icon size={20} aria-label={name} animateOnHover />
        </>,
    );
    const animated = screen.getByLabelText(name);

    await user.hover(animated);

    expect(animated.children.length).toBe(
        screen.getByLabelText(`${name} static`).children.length,
    );
});
