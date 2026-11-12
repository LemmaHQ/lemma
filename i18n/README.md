# Interface strings

English | [中文](README.zh.md)

`i18n/` holds the English and Chinese text of Lemma's clients in platform-neutral YAML sources. The generator [`gen-i18n.ts`](../scripts/i18n/gen-i18n.ts) validates those sources and writes the web client's i18next locales and the Android client's string resources. Edit the YAML sources, not the generated files.

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

The web and Android outputs contain the literal text `{model}`.

## Adding a string

1. Choose its namespace file and nested key, then add an entry with both languages.
2. Declare every parameter and add `platforms` when the string does not apply to every client.
3. For a plural, set `plural` and supply the required forms.
4. Run `just i18n-gen`, then `just scripts-test` and the affected clients' tests (`just web-test`, `just mobile-android-test`).

Generation rejects unknown entry keys, invalid platforms or parameter types, missing languages or plural forms, undeclared placeholders, and unused parameters. An error names the source file and key path, and generation writes no output.

## Outputs

`just i18n-gen` writes Git-ignored files for two clients: web entries whose platform list includes `web`, and Android entries whose list includes `android`.

| File | Content |
| --- | --- |
| `web/src/i18n/locales/en.json` | English i18next messages. |
| `web/src/i18n/locales/zh.json` | Chinese i18next messages. |
| `mobile/shared/src/commonMain/composeResources/values/strings.xml` | English Android string and plural resources. |
| `mobile/shared/src/commonMain/composeResources/values-zh/strings.xml` | Chinese Android string and plural resources. |

The web renderer changes `{name}` to `{{name}}`, removes brace escapes, and expands a plural entry into `<key>_one` and `<key>_other`. When Chinese has only `other`, both web keys receive that text.

The Android renderer names each resource by joining the key path's segments, converted from camelCase to snake_case, with underscores: `provider.apiKeyDesc` becomes `provider_api_key_desc`. Two entries mapping to one resource name fail generation. A `{name}` placeholder becomes `%1$s` for a string or `%1$d` for a number, numbered by the parameters' declaration order. A plural entry becomes `<plurals>` with the forms the language defines. Literal backslashes are doubled and XML markup is escaped. Kotlin reads the resources through Compose's generated `Res.string` and `Res.plurals` accessors.
