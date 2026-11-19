# Interface strings

English | [中文](README.zh.md)

`i18n/` holds the English and Chinese UI text of Lemma's clients in platform-neutral YAML sources. [`gen-i18n.ts`](../scripts/i18n/gen-i18n.ts) (`just i18n-gen`) validates those sources and writes the web i18next locales and Android string resources. Edit the YAML sources, never the generated files.

## Source files

Each `<namespace>.yaml` file holds one top-level namespace. Nested maps group messages; a map with `en` or `zh` is a message entry requiring both languages.

```yaml
sidebar:
    renameSession:
        platforms: [web, android]
        params: { title: string }
        en: "Rename {title}"
        zh: "重命名{title}"
```

| Field       | Required | Meaning                                                                  |
| ----------- | -------- | ------------------------------------------------------------------------ |
| `en`, `zh`  | Yes      | English and Chinese text, or plural-form maps when `plural` is present.  |
| `params`    | No       | Named parameters (`string` or `number`), referenced in text as `{name}`. |
| `platforms` | No       | List of `web` / `android`; omitted includes both.                        |
| `plural`    | No       | Name of a `number` parameter in `params` selecting the plural form.      |

Every placeholder must name a declared parameter, and every declared parameter must appear in the sole form or plural `other` form. English plurals require `one` and `other`; Chinese plurals require `other`.

## Literal braces

Escape literal braces with a backslash (`\{`, `\}`) inside single-quoted YAML so backslashes reach the generator unchanged:

```yaml
provider:
    apiPathDescGemini:
        platforms: [web]
        en: 'The path may contain \{model\}.'
        zh: '路径可以包含 \{model\}。'
```

## Adding a string

1. Add the entry with both `en` and `zh` under its namespace file and nested key, declaring any `params`, `platforms`, or `plural` forms.
2. Run `just i18n-gen`, then `just scripts-test` and the affected client tests (`just web-test`, `just mobile-android-test`).

## Outputs

`just i18n-gen` writes Git-ignored files for each platform:

| File                                                                  | Content                                 |
| --------------------------------------------------------------------- | --------------------------------------- |
| `web/src/i18n/locales/en.json`                                        | English i18next messages                |
| `web/src/i18n/locales/zh.json`                                        | Chinese i18next messages                |
| `mobile/shared/src/commonMain/composeResources/values/strings.xml`    | English Android string/plural resources |
| `mobile/shared/src/commonMain/composeResources/values-zh/strings.xml` | Chinese Android string/plural resources |

Android resource names join camelCase-to-snake_case key segments with underscores (`provider.apiKeyDesc` → `provider_api_key_desc`), and generation fails if two entries collide on the same resource name. Kotlin reads resources through Compose's generated `Res.string` and `Res.plurals` accessors.
