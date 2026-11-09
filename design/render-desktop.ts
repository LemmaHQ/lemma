import type { Theme, ThemeName } from "./read-tokens.ts";

export function generateDesktopTheme(
    themes: Record<ThemeName, Theme>,
    radii: Map<string, number>,
): string {
    const radius = requiredRadius(radii, "md");
    const radiusLg = requiredRadius(radii, "lg");
    const output = {
        name: "Lemma",
        themes: (["light", "dark"] as const).map((mode) => ({
            name: `Lemma ${mode === "light" ? "Light" : "Dark"}`,
            mode,
            "font.size": 14,
            radius,
            "radius.lg": radiusLg,
            colors: themeColors(requiredTheme(themes, mode)),
        })),
    };
    return `${JSON.stringify(output, null, 4)}\n`;
}

function requiredTheme(
    themes: Record<ThemeName, Theme>,
    mode: ThemeName,
): Theme {
    const theme = themes[mode];
    if (!(theme instanceof Map)) {
        throw new TypeError(`desktop theme requires the ${mode} color roles`);
    }
    return theme;
}

function requiredRadius(radii: Map<string, number>, name: string): number {
    const radius = radii.get(name);
    if (radius === undefined) {
        throw new Error(`desktop theme requires radius.${name}`);
    }
    return radius;
}

function themeColors(theme: Theme): Record<string, string> {
    const role = (name: string): string => {
        const color = theme.get(name);
        if (color === undefined) {
            throw new Error(`desktop theme requires the ${name} color role`);
        }
        return color;
    };
    const primary = role("primary");
    const primaryForeground = role("primary-foreground");
    const primaryHover = role("primary-hover");
    const secondary = role("secondary");
    const secondaryForeground = role("secondary-foreground");
    const secondaryHover = role("secondary-hover");
    const background = role("background");
    const foreground = role("foreground");
    const muted = role("muted");
    const mutedForeground = role("muted-foreground");
    const accent = role("accent");
    const selected = role("selected");
    const border = role("border");
    const ring = role("ring");
    const sidebar = role("sidebar");
    const danger = role("destructive");
    const success = role("success");
    const warning = role("warning");
    const control = role("control");
    const track = role("track");
    const thumb = role("thumb");

    return {
        ...variantColors("button", control, foreground, accent, selected),
        ...variantColors(
            "button.primary",
            primary,
            primaryForeground,
            primaryHover,
        ),
        ...variantColors(
            "button.secondary",
            secondary,
            secondaryForeground,
            secondaryHover,
        ),
        ...variantColors(
            "button.danger",
            danger,
            primaryForeground,
            darker(danger),
        ),
        ...variantColors(
            "button.info",
            primary,
            primaryForeground,
            primaryHover,
        ),
        ...variantColors(
            "button.success",
            success,
            primaryForeground,
            darker(success),
        ),
        ...variantColors(
            "button.warning",
            warning,
            primaryForeground,
            darker(warning),
        ),
        ...variantColors("primary", primary, primaryForeground, primaryHover),
        ...variantColors(
            "secondary",
            secondary,
            secondaryForeground,
            secondaryHover,
        ),
        ...variantColors("danger", danger, primaryForeground, darker(danger)),
        ...variantColors("info", primary, primaryForeground, primaryHover),
        ...variantColors(
            "success",
            success,
            primaryForeground,
            darker(success),
        ),
        ...variantColors(
            "warning",
            warning,
            primaryForeground,
            darker(warning),
        ),
        "accent.background": accent,
        "accent.foreground": role("accent-foreground"),
        "accordion.background": role("card"),
        background,
        border,
        "group_box.background": role("card"),
        "group_box.foreground": role("card-foreground"),
        "group_box.title.foreground": foreground,
        caret: primary,
        "chart.bullish": success,
        "chart.bearish": danger,
        "chart.grid": border,
        "description_list.label.background": muted,
        "description_list.label.foreground": mutedForeground,
        "drag.border": ring,
        "drop_target.background": selected,
        foreground,
        "input.border": role("input"),
        link: primary,
        "link.active": primaryHover,
        "link.hover": primaryHover,
        "list.background": background,
        "list.active.background": selected,
        "list.active.border": ring,
        "list.even.background": role("card"),
        "list.head.background": muted,
        "list.hover.background": accent,
        "muted.background": muted,
        "muted.foreground": mutedForeground,
        "popover.background": role("popover"),
        "popover.foreground": role("popover-foreground"),
        "progress.bar.background": primary,
        ring,
        "scrollbar.background": track,
        "scrollbar.thumb.background": thumb,
        "scrollbar.thumb.hover.background": darker(thumb),
        "selection.background": selected,
        "sidebar.background": sidebar,
        "sidebar.accent.background": role("sidebar-accent"),
        "sidebar.accent.foreground": role("sidebar-accent-foreground"),
        "sidebar.border": role("sidebar-border"),
        "sidebar.foreground": role("sidebar-foreground"),
        "sidebar.primary.background": role("sidebar-primary"),
        "sidebar.primary.foreground": role("sidebar-primary-foreground"),
        "skeleton.background": muted,
        "slider.background": track,
        "slider.thumb.background": thumb,
        "switch.background": track,
        "switch.thumb.background": thumb,
        "tab.background": background,
        "tab.active.background": selected,
        "tab.active.foreground": foreground,
        "tab_bar.background": background,
        "tab_bar.segmented.background": secondary,
        "tab.foreground": foreground,
        "table.background": role("card"),
        "table.active.background": selected,
        "table.active.border": ring,
        "table.even.background": role("card"),
        "table.head.background": muted,
        "table.head.foreground": mutedForeground,
        "table.foot.background": muted,
        "table.foot.foreground": mutedForeground,
        "table.hover.background": accent,
        "table.row.border": border,
        "title_bar.background": sidebar,
        "title_bar.border": role("sidebar-border"),
        "status_bar.background": sidebar,
        "status_bar.border": role("sidebar-border"),
        overlay: role("scrim"),
        "window.border": border,
        "base.blue": primary,
        "base.blue.light": primaryHover,
        "base.red": danger,
        "base.red.light": danger,
        "base.green": success,
        "base.green.light": success,
        "base.yellow": warning,
        "base.yellow.light": warning,
    };
}

function variantColors(
    prefix: string,
    background: string,
    foreground: string,
    hover: string,
    active = hover,
): Record<string, string> {
    return {
        [`${prefix}.background`]: background,
        [`${prefix}.foreground`]: foreground,
        [`${prefix}.hover.background`]: hover,
        [`${prefix}.active.background`]: active,
    };
}

function darker(hex: string): string {
    const digits = hex.slice(1);
    const rgb = [0, 2, 4].map((offset) =>
        Math.round(Number.parseInt(digits.slice(offset, offset + 2), 16) * 0.9),
    );
    const alpha = digits.length === 8 ? digits.slice(6) : "";
    return `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}${alpha}`;
}
