# HTML report

The review is one self-contained HTML file in the OS temp directory. Tailwind and Mermaid come from CDNs. Mermaid handles graph-shaped diagrams; hand-built divs and inline SVG handle editorial visuals such as mass diagrams and cross-sections. Mix the two so the diagrams do not all look alike.

## File

Resolve the temp directory from `%TEMP%` on Windows, else `$TMPDIR`, else `/tmp`, and write `<tmpdir>/architecture-review-<timestamp>.html` so each run gets a fresh file. Open it with `start` on Windows, `open` on macOS, or `xdg-open` on Linux, and give the user the absolute path.

## Scaffold

```html
<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <title>Architecture review for {{repo name}}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script type="module">
            import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
            mermaid.initialize({ startOnLoad: true, theme: "neutral", securityLevel: "loose" });
        </script>
        <style>
            .seam { stroke-dasharray: 4 4; }
            .leak { stroke: #dc2626; }
            .deep { background: linear-gradient(135deg, #0f172a, #1e293b); }
        </style>
    </head>
    <body class="bg-stone-50 text-slate-900 font-sans">
        <main class="max-w-5xl mx-auto px-6 py-12 space-y-12">
            <header>...</header>
            <section id="candidates" class="space-y-10">...</section>
            <section id="top-recommendation">...</section>
        </main>
    </body>
</html>
```

The Tailwind CDN and the Mermaid import are the only scripts; the report is otherwise static.

## Header

Repository name, date, and a compact legend: solid box = module, dashed line = seam, red arrow = leakage, thick dark box = deep module. No introduction; go straight to the candidates.

## Candidate card

The diagrams carry the weight. Each candidate is one `<article>`:

- **Title**: short, names the deepening, such as "Collapse provider model listing".
- **Badges**: strength (`Strong` emerald, `Worth exploring` amber, `Speculative` slate) and dependency category (`in-process`, `local-substitutable`, `remote-owned`, `external`).
- **Files**: monospaced list, `font-mono text-sm`.
- **Before / after diagram**: two columns side by side, about 320px tall.
- **Problem**: one sentence on what hurts.
- **Solution**: one sentence on what changes.
- **Wins**: bullets of six words or fewer, in vocabulary terms: "locality: bugs concentrate in one module", "interface shrinks; implementation absorbs the wrappers". Never "easier to maintain" or "cleaner code".
- **Settled-design callout**, when the candidate contradicts architecture.md: one line in an amber box saying why it is worth reopening.

If a diagram needs a paragraph to be understood, redraw the diagram.

## Diagram patterns

- **Mermaid graph**: for "X calls Y calls Z". A `flowchart` in a bordered white card, with a `classDef` coloring leakage edges red and the deep module dark. Sequence diagrams suit "before: six round trips; after: one".
- **Hand-built boxes and arrows**: `div` modules with inline SVG arrows over a relative container, for an "after" that must read as one thick-bordered deep module with faded internals.
- **Cross-section**: stacked bands (`h-12 border-l-4`) for the layers a call passes through: many thin bands before, one thick band after.
- **Mass diagram**: two rectangles per module, interface and implementation. Shallow: nearly equal heights. Deep: short interface, tall implementation.
- **Call-graph collapse**: a call tree as nested boxes before; the same tree collapsed into one box with the now-internal calls faded inside after.

```html
<div class="rounded-lg border border-slate-200 bg-white p-4">
    <pre class="mermaid">
        flowchart LR
            A[ProvidersPanel] --> B[providers store]
            B --> C[ProviderService]
            C -.leak.-> D[adapter model listing]
            classDef leak stroke:#dc2626,stroke-width:2px;
            class C,D leak
    </pre>
</div>
```

## Style

Editorial, not dashboard: generous whitespace, optional `font-serif` headings, one accent (emerald or indigo) plus red for leakage and amber for warnings. Module labels inside diagrams use `text-xs uppercase tracking-wider`.

## Top recommendation

One larger card: the candidate name, one sentence on why, and an anchor link to its card.

## Tone

Plain and concise, with the architectural nouns and verbs from [vocabulary.md](vocabulary.md): "The provider module is shallow: its interface nearly matches its implementation." "Model listing leaks across the seam." "Two adapters justify the seam: SeaORM in production, in-memory SQLite in tests." No hedging; a sentence that could be a bullet becomes one, and a bullet that could be cut is cut.
