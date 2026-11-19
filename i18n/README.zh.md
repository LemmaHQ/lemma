# 界面文案

[English](README.md) | 中文

`i18n/` 以平台无关的 YAML 源文件存放 Lemma 客户端的中英文界面文案。[`gen-i18n.ts`](../scripts/i18n/gen-i18n.ts)（`just i18n-gen`）校验源文件并生成 Web 的 i18next 语言包与 Android 字符串资源。只编辑 YAML 源文件，不要手改生成文件。

## 源文件

每个 `<namespace>.yaml` 对应一个顶层命名空间。嵌套映射用于分组，包含 `en` 或 `zh` 的映射为一条文案条目，且两种语言必填。

```yaml
sidebar:
    renameSession:
        platforms: [web, android]
        params: { title: string }
        en: "Rename {title}"
        zh: "重命名{title}"
```

| 字段        | 必填 | 含义                                                       |
| ----------- | ---- | ---------------------------------------------------------- |
| `en`、`zh`  | 是   | 中英文文案；声明 `plural` 时为复数形态映射。               |
| `params`    | 否   | 具名参数（`string` 或 `number`），文案中以 `{name}` 引用。 |
| `platforms` | 否   | 包含 `web` 或 `android` 的列表；省略则同时面向两端。       |
| `plural`    | 否   | `params` 中某个 `number` 参数的名称，用于选择复数形态。    |

每个占位符都必须对应已声明的参数，每个已声明的参数都必须出现在唯一文案或复数 `other` 形态中。英文复数必填 `one` 与 `other`；中文复数必填 `other`。

## 字面花括号

字面花括号使用反斜杠转义（`\{`、`\}`），并用 YAML 单引号包裹以将反斜杠原样传给生成器：

```yaml
provider:
    apiPathDescGemini:
        platforms: [web]
        en: 'The path may contain \{model\}.'
        zh: '路径可以包含 \{model\}。'
```

## 新增文案

1. 在对应命名空间文件与嵌套键下添加包含 `en` 与 `zh` 的条目，按需声明 `params`、`platforms` 或 `plural`。
2. 运行 `just i18n-gen`，再运行 `just scripts-test` 及受影响的客户端测试（`just web-test`、`just mobile-android-test`）。

## 生成产物

`just i18n-gen` 为各平台写出 Git 忽略的产物文件：

| 文件                                                                  | 内容                          |
| --------------------------------------------------------------------- | ----------------------------- |
| `web/src/i18n/locales/en.json`                                        | 英文 i18next 文案             |
| `web/src/i18n/locales/zh.json`                                        | 中文 i18next 文案             |
| `mobile/shared/src/commonMain/composeResources/values/strings.xml`    | 英文 Android 字符串与复数资源 |
| `mobile/shared/src/commonMain/composeResources/values-zh/strings.xml` | 中文 Android 字符串与复数资源 |

Android 资源名将键路径各段从 camelCase 转为 snake_case 并以下划线连接（`provider.apiKeyDesc` → `provider_api_key_desc`），若两条文案映射到同一个资源名则生成失败。Kotlin 通过 Compose 生成的 `Res.string` 与 `Res.plurals` 访问器读取资源。
