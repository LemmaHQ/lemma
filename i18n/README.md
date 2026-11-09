# Interface strings

English | [中文](README.zh.md)

`i18n/` holds the English and Chinese text of Lemma's clients in platform-neutral YAML sources. The generator validates those sources and writes the web client's i18next locales. Edit the YAML sources, not the generated JSON.

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
4. Run `just i18n-gen`, then `just i18n-test` and `just web-test`.

Generation rejects unknown entry keys, invalid platforms or parameter types, missing languages or plural forms, undeclared placeholders, and unused parameters. An error names the source file and key path, and generation writes no output.

## Outputs

`just i18n-gen` writes these Git-ignored files for entries whose platform list includes `web`:

| File | Content |
| --- | --- |
| `web/src/i18n/locales/en.json` | English i18next messages. |
| `web/src/i18n/locales/zh.json` | Chinese i18next messages. |

The web renderer changes `{name}` to `{{name}}`, removes brace escapes, and expands a plural entry into `<key>_one` and `<key>_other`. When Chinese has only `other`, both web keys receive that text. The validated entries retain their platform lists, parameter types, and plural forms for client-specific renderers.
