# 界面文案

[English](README.md) | 中文

`i18n/` 以平台中立的 YAML 源文件保存 Lemma 客户端的英文与中文文案。生成器验证这些源文件，并生成 Web 客户端的 i18next 语言文件。修改 YAML 源文件，不修改生成的 JSON。

## 源文件

每个 `<namespace>.yaml` 文件保存一个顶层命名空间。嵌套 map 对消息分组；包含 `en` 或 `zh` 的 map 是消息条目。`en` 与 `zh` 都必须提供。

```yaml
version:
  server:
    platforms: [web]
    params: { version: string }
    en: "Server v{version}"
    zh: "服务端 v{version}"
```

条目接受以下字段：

| 字段 | 必需 | 含义 |
| --- | --- | --- |
| `en`、`zh` | 是 | 英文与中文文案；存在 `plural` 时，值为复数形式 map。 |
| `params` | 否 | 命名参数，类型为 `string` 或 `number`。文案以 `{name}` 引用参数。 |
| `platforms` | 否 | 由 `web`、`android` 或 `desktop` 组成的列表。省略表示适用于全部三个平台。 |
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

Web 输出包含字面量文本 `{model}`。

## 添加文案

1. 选择命名空间文件与嵌套键，添加同时包含两种语言的条目。
2. 声明每个参数；文案不适用于所有客户端时，添加 `platforms`。
3. 复数文案设置 `plural`，并提供必需的形式。
4. 运行 `just i18n-gen`，然后运行 `just i18n-test` 与 `just web-test`。

生成器拒绝未知条目键、无效平台或参数类型、缺失的语言或复数形式、未声明的参数以及未使用的参数。错误信息包含源文件与键路径；验证失败时不写入输出。

## 输出

`just i18n-gen` 为平台列表包含 `web` 的条目生成以下被 Git 忽略的文件：

| 文件 | 内容 |
| --- | --- |
| `web/src/i18n/locales/en.json` | 英文 i18next 消息。 |
| `web/src/i18n/locales/zh.json` | 中文 i18next 消息。 |

Web 渲染器把 `{name}` 转为 `{{name}}`，移除花括号转义，并把复数条目展开为 `<key>_one` 与 `<key>_other`。中文只有 `other` 时，两个 Web 键都使用该文案。验证后的条目保留平台列表、参数类型与复数形式，供各客户端的渲染器使用。
