# 界面文案

[English](README.md) | 中文

`i18n/` 以平台中立的 YAML 源文件保存 Lemma 客户端的英文与中文文案。生成器 [`gen-i18n.ts`](../scripts/i18n/gen-i18n.ts) 验证这些源文件，并生成 Web 客户端的 i18next 语言文件与 Android 客户端的字符串资源。修改 YAML 源文件，不修改生成的文件。

## 源文件

每个 `<namespace>.yaml` 文件保存一个顶层命名空间。嵌套 map 对消息分组；包含 `en` 或 `zh` 的 map 是消息条目。`en` 与 `zh` 都必须提供。

```yaml
sidebar:
  renameSession:
    platforms: [web, android]
    params: { title: string }
    en: "Rename {title}"
    zh: "重命名{title}"
```

条目接受以下字段：

| 字段 | 必需 | 含义 |
| --- | --- | --- |
| `en`、`zh` | 是 | 英文与中文文案；存在 `plural` 时，值为复数形式 map。 |
| `params` | 否 | 命名参数，类型为 `string` 或 `number`。文案以 `{name}` 引用参数。 |
| `platforms` | 否 | 由 `web` 或 `android` 组成的列表。省略表示适用于两个平台。 |
| `plural` | 否 | `params` 中已声明的 `number` 参数名，用于选择复数形式。 |

每个 `{name}` 都必须引用已声明的参数。每个已声明的参数都必须出现在各语言唯一的形式或复数 `other` 形式中。英文复数要求 `one` 与 `other`；中文复数要求 `other`。

## 字面量花括号

用反斜杠转义字面量花括号：`\{` 与 `\}`。YAML 使用单引号，使反斜杠原样传给生成器。

```yaml
provider:
  apiPathDescGemini:
    platforms: [web]
    en: 'The path may contain \{model\}.'
    zh: '路径可以包含 \{model\}。'
```

Web 与 Android 输出包含字面量文本 `{model}`。

## 添加文案

1. 选择命名空间文件与嵌套键，添加同时包含两种语言的条目。
2. 声明每个参数；文案不适用于所有客户端时，添加 `platforms`。
3. 复数文案设置 `plural`，并提供必需的形式。
4. 运行 `just i18n-gen`，然后运行 `just scripts-test` 与受影响客户端的测试（`just web-test`、`just mobile-android-test`）。

生成器拒绝未知条目键、无效平台或参数类型、缺失的语言或复数形式、未声明的参数以及未使用的参数。错误信息包含源文件与键路径；验证失败时不写入输出。

## 输出

`just i18n-gen` 为两个客户端生成被 Git 忽略的文件：平台列表包含 `web` 的条目生成 Web 输出，包含 `android` 的条目生成 Android 输出。

| 文件 | 内容 |
| --- | --- |
| `web/src/i18n/locales/en.json` | 英文 i18next 消息。 |
| `web/src/i18n/locales/zh.json` | 中文 i18next 消息。 |
| `mobile/shared/src/commonMain/composeResources/values/strings.xml` | 英文 Android 字符串与复数资源。 |
| `mobile/shared/src/commonMain/composeResources/values-zh/strings.xml` | 中文 Android 字符串与复数资源。 |

Web 渲染器把 `{name}` 转为 `{{name}}`，移除花括号转义，并把复数条目展开为 `<key>_one` 与 `<key>_other`。中文只有 `other` 时，两个 Web 键都使用该文案。

Android 渲染器把键路径的各段从 camelCase 转为 snake_case，再用下划线连接成资源名：`provider.apiKeyDesc` 变为 `provider_api_key_desc`。两个条目映射到同一资源名时生成失败。`{name}` 占位符按参数声明顺序编号，字符串变为 `%1$s`，数字变为 `%1$d`。复数条目变为 `<plurals>`，包含该语言定义的形式。字面量反斜杠加倍，XML 标记转义。Kotlin 通过 Compose 生成的 `Res.string` 与 `Res.plurals` 访问器读取这些资源。
