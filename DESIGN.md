---
version: alpha
name: Lemma
description: "Lemma's design system: a three-state (light / dark / system) self-hosted AI chat workbench. Sky blue #60b1ff is the single chromatic accent, with the focus ring derived from it and hovers expressed as opacity. Surfaces are role-based (canvas / sidebar / composer / card / popover) with hairline borders; shadows belong to overlays only. Dark mode pairs a pure-black sidebar with a viewport-fixed vertical gradient canvas. Fonts are self-hosted: Sarasa UI SC for UI text (CJK included) and Maple Mono NF CN for code (Nerd Font icons render). The rhythm is a workbench — 260px session sidebar, centered max-w-3xl conversation column, bottom composer."

colors:
  primary: "#60b1ff"
  primary-foreground: "#0b1220"
  ring: "#60b1ff66"
  warning: "#b45309"
  warning-soft: "#fffbeb"
  warning-border: "#fcd34d"
  success: "#27a644"
  background: "#fdfbfd"
  foreground: "#16181d"
  card: "#ffffff"
  card-foreground: "#16181d"
  popover: "#ffffff"
  popover-foreground: "#16181d"
  secondary: "#f0f2f4"
  secondary-foreground: "#2b2e33"
  muted: "#f2f3f5"
  muted-foreground: "#5f636a"
  accent: "#eef0f4"
  accent-foreground: "#232933"
  destructive: "#c53637"
  destructive-foreground: "#f8f8f8"
  border: "#dfe1e5"
  input: "#dfe1e5"
  sidebar: "#fcf8fb"
  sidebar-foreground: "#16181d"
  sidebar-border: "#dfe1e5"
  sidebar-accent: "#f4f3f2"
  sidebar-accent-foreground: "#232933"
  code: "#f0f2f4"
  code-foreground: "#232933"
  code-border: "#dfe1e5"
  composer: "#ffffff"
  dark-canvas-from: "#0e0d0f"
  dark-canvas-to: "#1c1e1b"
  dark-background: "#151615"
  dark-foreground: "#e3e5e8"
  dark-card: "#1d1f23"
  dark-card-foreground: "#e3e5e8"
  dark-popover: "#1d1f23"
  dark-popover-foreground: "#e3e5e8"
  dark-secondary: "#24272b"
  dark-secondary-foreground: "#ccced1"
  dark-muted: "#222428"
  dark-muted-foreground: "#91959d"
  dark-accent: "#292b30"
  dark-accent-foreground: "#e1e5eb"
  dark-destructive: "#da534f"
  dark-destructive-foreground: "#f5f5f5"
  dark-border: "#2e3035"
  dark-input: "#35383d"
  dark-sidebar: "#000000"
  dark-sidebar-foreground: "#e3e5e8"
  dark-sidebar-border: "#2e3035"
  dark-sidebar-accent: "#212429"
  dark-sidebar-accent-foreground: "#e1e5eb"
  dark-code: "#1f2226"
  dark-code-foreground: "#d0d4db"
  dark-code-border: "#2e3035"
  dark-composer: "#252528"
  dark-warning: "#fbbf24"
  dark-warning-soft: "#451a03"
  dark-warning-border: "#92400e"
  dark-success: "#3fb950"

typography:
  display-xl:
    fontFamily: Sarasa UI SC
    fontSize: 80px
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: -3.0px
  display-lg:
    fontFamily: Sarasa UI SC
    fontSize: 56px
    fontWeight: 600
    lineHeight: 1.10
    letterSpacing: -1.8px
  display-md:
    fontFamily: Sarasa UI SC
    fontSize: 40px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -1.0px
  headline:
    fontFamily: Sarasa UI SC
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.20
    letterSpacing: -0.6px
  card-title:
    fontFamily: Sarasa UI SC
    fontSize: 22px
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: -0.4px
  subhead:
    fontFamily: Sarasa UI SC
    fontSize: 20px
    fontWeight: 400
    lineHeight: 1.40
    letterSpacing: -0.2px
  body-lg:
    fontFamily: Sarasa UI SC
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: -0.1px
  body:
    fontFamily: Sarasa UI SC
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: -0.05px
  body-sm:
    fontFamily: Sarasa UI SC
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.60
    letterSpacing: 0px
  caption:
    fontFamily: Sarasa UI SC
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.40
    letterSpacing: 0px
  button:
    fontFamily: Sarasa UI SC
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.20
    letterSpacing: 0px
  eyebrow:
    fontFamily: Sarasa UI SC
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.30
    letterSpacing: 0.4px
  mono:
    fontFamily: Maple Mono NF CN
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: 0px
  mono-sm:
    fontFamily: Maple Mono NF CN
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.40
    letterSpacing: 0px

rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  xxl: 24px
  pill: 9999px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 96px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: 36px
    padding: 16px
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: 36px
    padding: 16px
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: 36px
    padding: 16px
    borderColor: "{colors.border}"
  button-ghost:
    textColor: "{colors.foreground}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: 36px
    padding: 16px
  button-ghost-hover:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: 36px
    padding: 16px
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive-foreground}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: 36px
    padding: 16px
  text-input:
    textColor: "{colors.foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    height: 36px
    padding: 12px
    borderColor: "{colors.input}"
  text-input-focus:
    textColor: "{colors.foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    height: 36px
    padding: 12px
    borderColor: "{colors.ring}"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.xl}"
    padding: 24px
    borderColor: "{colors.border}"
  popover:
    backgroundColor: "{colors.popover}"
    textColor: "{colors.popover-foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 4px
    borderColor: "{colors.border}"
  tooltip:
    backgroundColor: "{colors.foreground}"
    textColor: "{colors.background}"
    typography: "{typography.caption}"
    rounded: "{rounded.md}"
    padding: 6px 12px
  switch:
    backgroundColor: "{colors.input}"
    rounded: "{rounded.full}"
    height: 18px
  tabs:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.button}"
    rounded: "{rounded.lg}"
    padding: 4px
  sidebar:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.sidebar-foreground}"
    typography: "{typography.body-sm}"
    width: 260px
    borderColor: "{colors.sidebar-border}"
  sidebar-session-row:
    textColor: "{colors.sidebar-foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 6px 12px
  sidebar-session-row-active:
    backgroundColor: "{colors.sidebar-accent}"
    textColor: "{colors.sidebar-foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 6px 12px
  settings-nav-item:
    textColor: "{colors.sidebar-foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 6px 8px
  settings-nav-item-active:
    backgroundColor: "{colors.sidebar-accent}"
    textColor: "{colors.sidebar-accent-foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 6px 8px
  message-bubble-user:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.xl}"
    padding: 10px 16px
  message-assistant:
    textColor: "{colors.foreground}"
    typography: "{typography.body-sm}"
  composer:
    backgroundColor: "{colors.composer}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.xl}"
    padding: 12px
    borderColor: "{colors.input}"
  model-switcher:
    textColor: "{colors.muted-foreground}"
    typography: "{typography.mono-sm}"
    rounded: "{rounded.md}"
  code-block:
    backgroundColor: "{colors.code}"
    textColor: "{colors.code-foreground}"
    typography: "{typography.mono}"
    rounded: "{rounded.md}"
    padding: 16px
    borderColor: "{colors.code-border}"
  banner-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 8px 12px
    borderColor: "{colors.warning-border}"
  status-success:
    textColor: "{colors.success}"
    typography: "{typography.body-sm}"
  auth-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.xl}"
    padding: 32px
    borderColor: "{colors.border}"
---

## Overview

Lemma is a self-hosted AI chat workbench with three theme states (light / dark / system). The design system is **semantic-token-only**: components reference semantic names like `{colors.card}` and `{typography.button}`. Both theme sets are authored in the colors block of this document; `theme.css` mirrors them value for value.

Surfaces are organized by **role**, not ladder: `{colors.background}` main canvas, `{colors.sidebar}` sidebar zone, `{colors.composer}` input zone, `{colors.card}` / `{colors.popover}` panels and overlays, `{colors.muted}` / `{colors.secondary}` / `{colors.accent}` fills. Light mode is all solid color — near-white canvas #fdfbfd, faintly warm sidebar #fcf8fb, pure white composer. Dark mode is a **pure black sidebar #000000 plus a vertical gradient canvas** (bottom `{colors.dark-canvas-from}` #0e0d0f → top `{colors.dark-canvas-to}` #1c1e1b, fixed to the viewport), composer #252528. Hierarchy comes from surface roles + hairline borders; shadows are reserved for overlays.

The single chromatic accent is sky blue `{colors.primary}` #60b1ff — primary buttons, focus rings, link emphasis — topped with dark ink text `{colors.primary-foreground}` #0b1220 for contrast. `{colors.ring}` is the primary at 40% alpha, #60b1ff66, stored flat: change the primary and re-derive the ring in the same edit. Hovers are opacity modifiers (`primary/90`), so they follow the primary without a token of their own. Three semantic colors are live: `{colors.destructive}`, `{colors.warning}` (with `warning-soft` / `warning-border`), and `{colors.success}`.

Fonts are dual self-hosted (woff2 from GitHub releases, no CDN): **Sarasa UI SC** (400/500/600) carries UI and body text — Latin from Iosevka, CJK included, identical rendering across platforms; **Maple Mono NF CN** (400/700) carries code — CJK 2:1 alignment, renders Nerd Font icons, so pasted terminal output no longer degrades to tofu boxes. The 13-step type scale is kept as-is, including negative display tracking (-3.0px @ 80px down to 0 at body).

The page rhythm is a **workbench, not a marketing narrative**: a 260px session sidebar on the left, the conversation flow in the middle (user messages right-aligned in `{colors.muted}` bubbles; assistant messages as inverse round avatar + plain flow), and the composer at the bottom (`{colors.composer}` panel + inverse round send button), with the content column capped at max-w-3xl. The language serves long reading and typing sessions, not presentation.

**Key Characteristics:**
- **Three-state theme** — solid light / gradient dark / follow system; semantic tokens defined once, valued per theme.
- **Single sky-blue accent** `{colors.primary}` #60b1ff — derived focus ring, opacity hovers, no second chromatic color.
- **Role-based surfaces** + hairline borders; components stay flat, shadows only on overlays.
- **Dual self-hosted fonts** — Sarasa UI SC + Maple Mono NF CN; CJK is a first-class citizen.
- **Workbench rhythm** — sidebar + conversation flow + composer; content column max-w-3xl.
- Radius ladder 4/6/8/12/16/24px — 8px for buttons and inputs, 16px for cards and bubbles.

## Colors

> The front matter above holds the values; this chapter explains each token's role and intent. Light values are unprefixed, dark overrides carry the `dark-` prefix, and `theme.css` mirrors them as `:root` / `[data-theme="dark"]`. Every value is an sRGB hex literal — the spec's `hex` color form — so the front matter round-trips through Stitch and `designmd export` unchanged. The neutrals were tuned in oklch and flattened here, which is why they carry digits like #16181d rather than round greys.

### Brand & Accent
- **Sky Blue** (`{colors.primary}`): The single chromatic accent #60b1ff — primary buttons, focus rings, link emphasis. Shared by both themes.
- **On Primary** (`{colors.primary-foreground}`): Dark ink #0b1220 on the primary color, for contrast. Shared by both themes.
- **Ring** (`{colors.ring}`): Focus ring — the primary at 40% alpha, #60b1ff66. Stored as a flat 8-digit hex rather than a `color-mix` expression so every consumer reads the same value; when the primary changes, the ring is re-derived in the same edit.
- No hover/pressed tokens: always opacity modifiers (`primary/90`, `secondary/80`).

### Surface
- **Background** (`{colors.background}`): Main canvas. Solid #fdfbfd in light; #151615 in dark as the gradient's midpoint fallback.
- **Canvas From / To** (`{colors.dark-canvas-from}` / `{colors.dark-canvas-to}`): Dark-only — the two ends of the main-area vertical gradient (bottom #0e0d0f → top #1c1e1b), anchored to the viewport via `background-attachment: fixed` so inner panel scrolling never stretches it.
- **Sidebar** (`{colors.sidebar}`): Sidebar zone. Faintly warm #fcf8fb in light; pure black #000000 in dark.
- **Composer** (`{colors.composer}`): Input-area panel. #ffffff in light; #252528 in dark.
- **Card / Popover** (`{colors.card}` / `{colors.popover}`): Panels and overlays. Both pure white in light; both first-step charcoal in dark.
- **Secondary / Muted / Accent**: The fill trio — secondary button background, subdued fill (user bubble), hover-state background.
- **Code** (`{colors.code}` + `{colors.code-border}`): Code block background and border; blocks overlay the canvas at 60% opacity.

### Text
- **Foreground** (`{colors.foreground}`): All headlines and primary body text.
- **Muted Foreground** (`{colors.muted-foreground}`): Secondary text — captions, meta info, group headers, placeholders.
- Every surface ships a matching text token with the same suffix (`card-foreground`, `sidebar-foreground`, `code-foreground`, ...).
- **Two text levels are deliberate**: finer hierarchy is carried by font weight (400/500/600), not by additional grays.

### Border
- **Border** (`{colors.border}`): Default hairline on cards and dividers.
- **Input** (`{colors.input}`): Input border, one step lighter than border in dark.
- Zone variants: `sidebar-border`, `code-border`, paired with their surfaces.

### Semantic
- **Destructive** (`{colors.destructive}`): Delete and dangerous actions; one lightness step per theme.
- **Warning** (`{colors.warning}` / `{colors.warning-soft}` / `{colors.warning-border}`): Banner trio — strong text, soft background, border. Adopted from the amber palette the migration banner shipped with.
- **Success** (`{colors.success}`): Positive feedback — storage test "Connected", migration finished.
- Overlay scrim: no dialog component yet; start at `black/60` when introduced, no standalone token.

## Typography

### Font Family

- **Sarasa UI SC** — self-hosted sans (OFL). Latin glyphs derive from Iosevka; CJK glyphs are bundled, so Chinese UI text renders identically on every platform. Weights: 400 / 500 / 600. Fallback stack: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`. Carries display-xl through eyebrow.
- **Maple Mono NF CN** — self-hosted mono (OFL). CJK aligns 2:1 with Latin; the Nerd Font patch renders icons in pasted terminal output instead of tofu boxes. Weights: 400 / 700. Fallback stack: `ui-monospace, "SF Mono", Menlo, Consolas, monospace`. Carries mono and mono-sm.

One sans family spans display to body; the family change is silent, hierarchy comes from weight and tracking.

### Hierarchy

| Token                     | Size | Weight | Line Height | Letter Spacing | Use                                      |
| ------------------------- | ---- | ------ | ----------- | -------------- | ---------------------------------------- |
| `{typography.display-xl}` | 80px | 600    | 1.05        | -3.0px         | Reserved: landing / marketing hero       |
| `{typography.display-lg}` | 56px | 600    | 1.10        | -1.8px         | Reserved: landing section openers        |
| `{typography.display-md}` | 40px | 600    | 1.15        | -1.0px         | Reserved: landing sub-sections           |
| `{typography.headline}`   | 28px | 600    | 1.20        | -0.6px         | Page-level titles                        |
| `{typography.card-title}` | 22px | 500    | 1.25        | -0.4px         | Card titles (auth card, settings panels) |
| `{typography.subhead}`    | 20px | 400    | 1.40        | -0.2px         | Lead paragraphs (empty state)            |
| `{typography.body-lg}`    | 18px | 400    | 1.50        | -0.1px         | Emphasized body, section titles          |
| `{typography.body}`       | 16px | 400    | 1.50        | -0.05px        | Default body                             |
| `{typography.body-sm}`    | 14px | 400    | 1.60        | 0              | UI workhorse: lists, forms, chat body    |
| `{typography.caption}`    | 12px | 400    | 1.40        | 0              | Captions, meta, group headers            |
| `{typography.button}`     | 14px | 500    | 1.20        | 0              | All button and tab labels                |
| `{typography.eyebrow}`    | 13px | 500    | 1.30        | 0.4px          | Uppercase taxonomy labels                |
| `{typography.mono}`       | 13px | 400    | 1.50        | 0              | Code blocks                              |
| `{typography.mono-sm}`    | 12px | 400    | 1.40        | 0              | Model IDs, inline code                   |

### Principles

- **Negative tracking belongs to display sizes** — -3.0px at 80px tapering to 0 at body; nothing at body size or below gets negative tracking.
- **Single voice from display to body.** Display-xl at 600 → body at 400 — one family (Sarasa), hierarchy via weight.
- **Eyebrow uses positive tracking** (+0.4px) — contrast against the negative-tracked display marks the eyebrow as taxonomy.
- **Mono marks machine text** — code blocks, inline code, model IDs. Never for prose.

### Self-hosting

- Both families are downloaded from their GitHub releases (Sarasa-Gothic, maple-font), converted to woff2 when the release ships TTF, vendored under the project, and registered via `@font-face` in `theme.css`. OFL license files ship alongside.
- No CDN, no font-service dependency; loading uses `font-display: swap` so system fonts render first.
- Mono loads on demand — pages without code never fetch it.

## Layout

### Spacing System

- **Base unit**: 4px — identical to Tailwind's scale, so every token maps 1:1 to a utility (`{spacing.md}` 16px = `p-4`).
- **Tokens (front matter)**: `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 16px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.xxl}` 48px · `{spacing.section}` 96px.
- Component conventions: buttons are 36px tall with 16px horizontal padding; form inputs 36px tall with 12px; card interiors `{spacing.lg}` 24px; auth card `{spacing.xl}` 32px; composer `{spacing.sm}` 12px.
- Fixed-height components (buttons, inputs) declare `height` plus a single `padding`, which is their horizontal inset — vertical centering comes from the height, not from padding. Content-height components (rows, bubbles, tooltip, banner) keep a two-value `padding`: CSS shorthand, `vertical horizontal`. The spec types `padding` as one `Dimension`, so the pairs are a deliberate extension the reference linter accepts; collapsing them to one number would lose the split that makes a row denser than it is wide.
- `{spacing.section}` 96px is reserved for landing pages — currently unused in the app.

### Grid & Container

- **Workbench layout**: fixed 260px sidebar + flexible main area. No marketing card grids.
- The chat content column is capped at max-w-3xl and centered; the composer follows the same column.
- Settings pages use a two-pane layout: nav rail + detail panel.
- User bubbles cap at 75% width, right-aligned; assistant messages span the content column.

### Whitespace Philosophy

Density serves long reading and typing sessions. Separation comes from **surface roles and hairline borders**, not from shadows or large gaps. The composer anchors to the bottom with breathing room around it (`{spacing.lg}` page padding). Empty states center their content instead of filling the canvas.

## Elevation & Depth

| Level          | Treatment                                                       | Use                                         |
| -------------- | --------------------------------------------------------------- | ------------------------------------------- |
| 0 (flat)       | No shadow, no border                                            | Body text, assistant messages, sidebar rows |
| 1 (panel)      | `{colors.card}` background, 1px `{colors.border}`               | Cards, settings panels, auth card           |
| 2 (fill shift) | `{colors.accent}` / `{colors.muted}` fill                       | Hovered rows, ghost buttons, selected tabs  |
| 3 (overlay)    | `{colors.popover}` background, 1px `{colors.border}`, shadow-md | Dropdown menus, selects, tooltips           |
| 4 (focus ring) | 3px `{colors.ring}`, derived from primary                       | Focused input, focused button               |

Depth is carried by surface roles + hairline borders. Components stay flat; drop shadows are granted to overlays only. The focus ring is the highest attention layer.

### Decorative Depth

- **The dark canvas gradient** (`{colors.dark-canvas-from}` → `{colors.dark-canvas-to}`) is the single atmospheric element — anchored to the viewport, calm, non-interactive.
- **Streaming cursor** — the pulsing caret on in-flight assistant messages is the only motion used as depth.
- No product screenshots, no edge highlights, no spotlight cards.

## Shapes

### Border Radius Scale

| Token            | Value  | Use                                                                 |
| ---------------- | ------ | ------------------------------------------------------------------- |
| `{rounded.xs}`   | 4px    | Inline code, sidebar inline action buttons                          |
| `{rounded.sm}`   | 6px    | Spare step — nothing assigned today                                 |
| `{rounded.md}`   | 8px    | All buttons, form inputs, session rows, code blocks, dropdown items |
| `{rounded.lg}`   | 12px   | Tabs track, new-chat button, page canvas panels                     |
| `{rounded.xl}`   | 16px   | Cards, user bubbles, composer                                       |
| `{rounded.xxl}`  | 24px   | Reserved (landing banners)                                          |
| `{rounded.pill}` | 9999px | Status pills                                                        |
| `{rounded.full}` | 9999px | Avatars, switch, round icon buttons (send / stop)                   |

`theme.css` derives the ladder from a single `--radius: 0.75rem` base, so all six steps resolve to exactly these values.

### Iconography & Avatars

- Icons are **Lucide**: 16px (`size-4`) default, 14px (`size-3.5`) in dense contexts, 12px (`size-3`) only for sidebar inline actions.
- Avatars are round initials / symbols, never photos: the 28px assistant avatar (inverse `bg-foreground` + Sparkles icon) and the 28px sidebar user avatar (username initial).
- No photography, no product screenshots, no logo walls anywhere in the app.

## Components

### Buttons

**`button-primary`** — Sky-blue CTA. Used sparingly: sign in, save changes, send-level actions.
- Background `{colors.primary}`, text `{colors.primary-foreground}`, type `{typography.button}`, 36px tall with 16px horizontal padding, rounded `{rounded.md}`.
- Hover is an opacity modifier (`primary/90`); focus is the 3px `{colors.ring}`.

**`button-secondary`** — Quiet filled button for secondary actions.
- Background `{colors.secondary}`, text `{colors.secondary-foreground}`; hover `secondary/80`.

**`button-outline`** — Bordered button on the page canvas.
- Background `{colors.background}`, 1px `{colors.border}` border; hover fills `{colors.accent}`.

**`button-ghost`** — Borderless action for dense toolbars and icon buttons.
- Transparent at rest; hover is the `button-ghost-hover` variant — `{colors.accent}` fill, `{colors.accent-foreground}` text — and `button-outline` hovers with the same pair. Icon buttons (copy, regenerate, collapse) are the same recipe, square or round.

**`button-destructive`** — Danger actions (delete provider, delete storage).
- Background `{colors.destructive}`, text `{colors.destructive-foreground}`; hover `destructive/90`.

### Forms

**`text-input`** — Hairline field: transparent background, 1px `{colors.input}` border. Textareas share the recipe.
- Type `{typography.body-sm}`, rounded `{rounded.md}`, 36px tall with 12px horizontal padding; placeholder in `{colors.muted-foreground}`.
- Focus keeps the surface: the `text-input-focus` variant swaps the edge to a 3px `{colors.ring}` ring. Buttons, selects, switches, tabs, and textareas focus through that same ring.

### Overlays

**`popover`** — Floating panel shared by dropdown menus and selects.
- Background `{colors.popover}`, 1px `{colors.border}`, rounded `{rounded.md}`, padding 4px.
- The only component family allowed a drop shadow (shadow-md); everything else stays flat.

**`tooltip`** — Inverse mini overlay.
- Background `{colors.foreground}`, text `{colors.background}`, type `{typography.caption}`, padding 6px 12px.

### Toggles

**`switch`** — Round-thumb toggle.
- Off: `{colors.input}`; on: `{colors.primary}`. Rounded `{rounded.full}`, 18px tall with a 16px thumb.

**`tabs`** — Segmented control (settings groups).
- Track `{colors.muted}` with `{colors.muted-foreground}` labels; the selected segment lifts to `{colors.background}` with shadow-xs and `{colors.foreground}` text. Selected = lift, not color.

### Sidebar

**`sidebar`** — The session rail, a dedicated surface zone.
- Background `{colors.sidebar}`, text `{colors.sidebar-foreground}`, width 260px; group headers in `{typography.caption}` + `{colors.muted-foreground}`. The footer strip is separated by a hairline `{colors.sidebar-border}`, the only edge the rail draws.

**`sidebar-session-row`** — One conversation in the list.
- Transparent at rest, rounded `{rounded.md}`, padding 6px 12px; hover tints `accent/60`. The open conversation is the `sidebar-session-row-active` variant — `{colors.sidebar-accent}` fill, weight bumped to 500, text unchanged.
- Inline actions (rename / archive) fade in on hover — the row stays text-pure at rest.

**`settings-nav-item`** — One row in the settings rail, the sidebar pattern at a tighter padding.
- Text `{colors.sidebar-foreground}`, rounded `{rounded.md}`, padding 6px 8px; hover tints `accent/60`.
- The selected row is `settings-nav-item-active`: `{colors.sidebar-accent}` fill with `{colors.sidebar-accent-foreground}` text — the one place that foreground pair is used.

### Messages

**`message-bubble-user`** — Right-aligned bubble, capped at 75% width.
- Background `{colors.muted}`, type `{typography.body-sm}`, rounded `{rounded.xl}`, padding 10px 16px.

**`message-assistant`** — Deliberately bubble-less: a 28px round inverse avatar (Sparkles) followed by plain-flowing markdown.
- Long answers read as documents, not chat frames. Errors render in `{colors.destructive}`; source and stop notices in `{typography.caption}` + `{colors.muted-foreground}`; action buttons are ghost icons.

### Composer

**`composer`** — The input panel, its own surface token.
- Background `{colors.composer}`, 1px `{colors.input}` border, rounded `{rounded.xl}`, padding 12px; the textarea inside is transparent and borderless.
- The send button is a 32px round **inverse** button (`{colors.foreground}` on `{colors.background}`), not primary — blue is reserved for system-level emphasis.

**`model-switcher`** — Ghost trigger + popover overlay.
- Model IDs render in `{typography.mono-sm}` — machine text in machine type.

### Code

**`code-block`** — Fenced code in chat.
- Background `{colors.code}` overlaid at 60% opacity, 1px `{colors.code-border}`, type `{typography.mono}`, padding 16px. Inline code uses the same family at 2px 4px padding.

### Feedback

**`banner-warning`** — Inline warning banner (pending migration notice).
- Background `{colors.warning-soft}`, 1px `{colors.warning-border}`, text `{colors.warning}`, type `{typography.body-sm}`, rounded `{rounded.md}`, padding 8px 12px.
- The three values are amber palette steps — 50 / 300 / 700 in light, 950 / 800 / 400 in dark — lifted from Tailwind's amber ramp rather than tuned like the neutrals.

**`status-success`** — Inline confirmation line (storage migrated, connection tested).
- Text `{colors.success}` at `{typography.body-sm}`; the terser connection-test variant drops to `{typography.caption}`. Success is text-only — there is no filled success banner.

### Auth

**`auth-card`** — The centered login / signup card.
- Background `{colors.card}`, 1px `{colors.border}`, rounded `{rounded.xl}`, padding 32px.

## Do's and Don'ts

### Do

- Reference **semantic tokens only** — a component never inlines a raw value.
- Reserve `{colors.primary}` sky blue for system-level emphasis: primary buttons, focus ring, link emphasis.
- Use **surface roles** for hierarchy — canvas, card, popover, plus the dedicated sidebar and composer zones.
- Pair display weight 600 with body weight 400 — resist 700+ display weights.
- Apply negative letter-spacing on display sizes only.
- Keep the focus ring at the primary's 40% alpha and express hover as opacity modifiers — the primary changes in one place and both follow.
- Compose buttons and inputs at `{rounded.md}` 8px corners; reserve `{rounded.full}` for avatars, switch, and round icon buttons (send / stop).

### Don't

- Don't hard-code raw color values in components — every surface, the migration banner included, resolves through a semantic token authored here and mirrored in `theme.css`.
- Don't introduce a second chromatic accent.
- Don't add drop shadows outside overlays (popover / dropdown / tooltip).
- Don't use display-size type inside the app — display-xl through display-md are reserved for landing pages.
- Don't load fonts from a CDN — both families are self-hosted woff2.
- Don't add more text grays — finer hierarchy comes from weight (400 / 500 / 600), not new shades.
- Don't pill-round rectangular CTAs.

## Responsive Behavior

### Breakpoints

| Name    | Width   | Key Changes                                          |
| ------- | ------- | ---------------------------------------------------- |
| Desktop | ≥1024px | Default workbench: 260px sidebar + main canvas       |
| Tablet  | 768px   | Content column shrinks; sidebar manually collapsible |
| Mobile  | <768px  | Not yet adapted (see Known Gaps)                     |

### Touch Targets

- Buttons are h-9 (36px), icon buttons 28–36px — below the 44px touch guidance. Desktop-first; revisit when mobile ships.
- Form inputs are h-9 (36px).

### Collapsing Strategy

- **Sidebar**: manual collapse, leaving an edge expand button; the session list scrolls independently.
- **Chat column**: capped at max-w-3xl and centered; user bubbles keep the 75% width cap.
- **Display type**: display sizes are reserved for landing pages, so no in-app scaling rules exist.

### Image Behavior

No images in the app — icons are Lucide, avatars are initial/symbol circles. Nothing to scale.

## Iteration Guide

1. Focus on ONE component at a time and reference it by its `components:` token name.
2. Introducing a surface: pick an existing role (`background` / `card` / `popover` / `sidebar` / `composer`); do not invent new ones casually.
3. Default UI text to `{typography.body-sm}` at weight 400; reach hierarchy through weight (500 / 600) before new sizes.
4. Run `npx -p @google/design.md designmd lint DESIGN.md` after edits — the bare `npx @google/design.md lint` form resolves to a different entry point and prints nothing at all. 0 errors required, and 41 warnings in exactly two buckets: 31 unreferenced `dark-*` colors (the dark set mirrors the light set by name, so components reference the light token and the theme swaps underneath) and 10 `borderColor` sub-tokens, which the spec names as its own example of an unknown component property and requires consumers to accept with a warning. A warning outside those two buckets is a regression — most often an orphaned token or a real contrast failure.
5. The front matter carries no YAML comments. A transparent rest state is expressed by omitting `backgroundColor`: `transparent` is a legal color keyword, but the linter flattens it to `#00000000` and then reports a spurious 1.18:1 contrast failure against it. Interaction states (hover / pressed / active) and pending changes belong in the matching prose chapter; add a variant as a separate `<component>-<state>` entry only when every property resolves to a token reference.
6. This document is the source of truth for every front-end design value. `theme.css` mirrors it by hand today: change the value here first, then the matching `--var` in `:root` / `[data-theme="dark"]`, keeping the two byte-identical; the Electron setup page (`desktop/src/setup.css`) carries the same dark values in its own `:root`. Colors are hex literals — do not reintroduce `oklch()` or `color-mix()` into the front matter. A generator is the planned replacement for the hand mirror.
7. Treat sky blue as scarce: primary buttons, focus ring, link emphasis.

## Known Gaps

- Form-field validation styling (`aria-invalid` rings exist in the primitives) is not designed into any flow yet.
- Mobile layout (<768px) is not adapted — sidebar and composer need a dedicated treatment.
- Open follow-ups from the color refactor: text shade calibration, chat bubble / avatar review, whether the login page joins the dark gradient.
- The mono font is not subset — the first code block on a slow network may swap in late.
