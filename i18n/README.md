# Interface strings

English | [中文](README.zh.md)

`i18n/` holds the English and Chinese text of Lemma's clients in platform-neutral YAML sources. The generators validate those sources and write the web client's i18next locales and the desktop client's Rust string functions. Edit the YAML sources, not generated output.

## Source files

Each `<namespace>.yaml` file holds one top-level namespace. Nested maps group messages; a map with `en` or `zh` is a message entry. Both `en` and `zh` are required.

```yaml
version:
  server:
    platforms: [web]
    params: { version: string }
    en: "Server v{version}"
    zh: "服务端 v{version}"
```

An entry accepts these fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `en`, `zh` | Yes | English and Chinese text, or plural-form maps when `plural` is present. |
| `params` | No | Named parameters with type `string` or `number`. Text references a parameter as `{name}`. |
| `platforms` | No | A list containing `web`, `android`, or `desktop`. Omit it to include all three. |
| `plural` | No | The name of a `number` parameter declared in `params`; it selects the plural form. |

Every placeholder must name a declared parameter. Every declared parameter must occur in each language's only form or plural `other` form. English plurals require `one` and `other`; Chinese plurals require `other`.

## Literal braces

Escape a literal brace with a backslash: `\{` and `\}`. Use single-quoted YAML so the backslashes reach the generator unchanged.

```yaml
provider:
  apiPathDescGemini:
    platforms: [web]
    en: 'The path may contain \{model\}.'
    zh: '路径可以包含 \{model\}。'
```

The web output contains the literal text `{model}`.

## Adding a string

1. Choose its namespace file and nested key, then add an entry with both languages.
2. Declare every parameter and add `platforms` when the string does not apply to every client.
3. For a plural, set `plural` and supply the required forms.
4. Run `just i18n-gen` and `just i18n-test`; run `just web-test` for web entries or `cargo nextest run -p lemma-desktop` for desktop entries.

Generation rejects unknown entry keys, invalid platforms or parameter types, missing languages or plural forms, undeclared placeholders, and unused parameters. An error names the source file and key path, and generation writes no output.

## Outputs

All generated files are ignored by Git. `just i18n-gen` writes these files for entries whose platform list includes `web`:

| File | Content | Consumer |
| --- | --- | --- |
| `web/src/i18n/locales/en.json` | English i18next messages. | The web client's i18next setup. |
| `web/src/i18n/locales/zh.json` | Chinese i18next messages. | The web client's i18next setup. |

The desktop build script runs `node i18n/gen-desktop.ts <output>` for entries whose platform list includes `desktop`. [`crates/desktop/lemma-desktop/src/strings.rs`](../crates/desktop/lemma-desktop/src/strings.rs) includes the generated Rust module from Cargo's output directory.

The web renderer changes `{name}` to `{{name}}`, removes brace escapes, and expands a plural entry into `<key>_one` and `<key>_other`. When Chinese has only `other`, both web keys receive that text.

The desktop renderer mirrors the key path with snake_case modules and functions. Rust keywords become raw identifiers; `crate`, `self`, `super`, names that cannot be raw identifiers, and collisions after conversion are errors naming the source key. Parameterless functions return `&'static str`. Functions with parameters return `String`, taking `string` parameters as `&str` and `number` parameters as `usize` in declaration order. English plurals select `one` only for a count of 1; Chinese uses `other`. Literal brace escapes produce literal braces in both clients.
