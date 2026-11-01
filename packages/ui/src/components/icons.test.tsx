import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { expect, it } from "vitest";

import * as thinkingLoader from "#ai/thinking-loader";
import * as toolCallIcons from "#ai/tool-call-icon";

import * as ui from "../index";

type IconComponent = ComponentType<{
    size?: number;
    "aria-label"?: string;
    animateOnHover?: boolean;
}>;

const NOT_GLYPHS = new Set([
    "AnimateIcon",
    ...Object.keys(thinkingLoader),
    ...Object.keys(toolCallIcons),
]);

const isGlyph = (entry: [string, unknown]): entry is [string, IconComponent] =>
    entry[0].endsWith("Icon") &&
    !NOT_GLYPHS.has(entry[0]) &&
    typeof entry[1] === "function";

const icons = Object.entries<unknown>(ui).filter(isGlyph);

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
