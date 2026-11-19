# Terminology

本表约定本仓库文档的中英术语统一译法，两个翻译方向都以它为准。术语在代码中的含义见 [glossary.md](../glossary.md)。

**通用规则：**

- "中文"列为中文正文的用词。若该列为英文，则中文正文保留英文不翻译。
- "不要译作"列为禁止的译法。
- 英文类术语在正文中小写；位于标题、表格单元格、段落或加粗引导语开头时首字母大写。
- 代码标识符、命令、路径与代码块中的代码保持原样，不适用本表。
- 本表未列出的术语，先沿用周围文档已有的译法；没有先例时保留英文，并在提交说明中列出，待加入本表。

## 缩写类（中英文文本中均使用缩写）

| English | 中文 | 不要译作 | 备注                           |
| ------- | ---- | -------- | ------------------------------ |
| API     | API  |          |                                |
| CI      | CI   |          |                                |
| CSS     | CSS  |          |                                |
| LLM     | LLM  | 大模型   |                                |
| RPC     | RPC  |          |                                |
| UI      | UI   |          | 组合词写作 `Web UI`、`UI 规则` |
| URL     | URL  |          | `base URL` 保留英文            |

## 英文类（中英文文本中均使用英文）

| English        | 中文           | 不要译作       | 备注                                                                     |
| -------------- | -------------- | -------------- | ------------------------------------------------------------------------ |
| agent          | agent          | 智能体、代理   |                                                                          |
| commit message | commit message | 提交消息       | 指文本本身；动作与提交对象写作"提交"                                     |
| crate          | crate          | 包、箱         |                                                                          |
| Developer Mode | Developer Mode | 开发者模式     | Windows 系统设置项，保留首字母大写                                       |
| fixture        | fixture        |                |                                                                          |
| mock           | mock           | 模拟           | 指测试替身                                                               |
| provider       | provider       | 供应商、提供商 | 文档正文保留英文；界面文案见下方"界面文案"                               |
| recipe         | recipe         | 配方           | `justfile` 命令                                                          |
| shim           | shim           | 垫片           |                                                                          |
| skill          | skill          | 技能           |                                                                          |
| step           | step           | 步骤           |                                                                          |
| token          | token          | 令牌、标记     | 设计 token 与模型用量 token                                              |
| toolchain      | toolchain      | 工具链         |                                                                          |
| trait          | trait          | 特征、特质     |                                                                          |
| turn           | turn           | 轮次、回合     |                                                                          |
| workspace      | workspace      |                | Cargo/npm workspace 保留英文；`workspaces/<session id>` 目录译作"工作区" |
| worktree       | worktree       | 工作树         |                                                                          |
| wrapper        | wrapper        | 包装器、封装器 |                                                                          |

## 中文类（有禁译项或易错译法）

| English             | 中文            | 不要译作           | 备注                             |
| ------------------- | --------------- | ------------------ | -------------------------------- |
| alert dialog        | 确认对话框      | 警告框             | `AlertDialog` 组件               |
| API format          | API 格式        | 方言、协议         |                                  |
| composer            | 输入框面板      | 编辑器             |                                  |
| elevation           | 层级            | 海拔、高度         |                                  |
| hairline            | 细线            | 发丝线             |                                  |
| model feature       | 模型特性        | 模型能力、模型功能 |                                  |
| overlay             | 浮层            | 覆盖层             |                                  |
| pair                | 配对            |                    | 中英文对照文件组                 |
| palette             | 色板            | 调色板             |                                  |
| placeholder         | 占位消息        |                    |                                  |
| predefined provider | 预定义 provider | 内置 provider      |                                  |
| primitive           | 原语            |                    | Base UI 原语                     |
| sealed key          | 加密 key        |                    |                                  |
| secret key          | 主密钥          | 加密密钥           | `secrets.json` 中的 `secret_key` |
| session             | 会话            | 对话               |                                  |
| toast               | 提示消息        | 吐司               | `sonner` 的 `toast`              |
| tool calling        | 工具调用        | 函数调用           |                                  |
| tooltip             | 工具提示        | 提示、气泡提示     | `Tooltip` 组件                   |
| utility class       | 工具类          | 实用类             | Tailwind 工具类                  |
| vendor              | 厂商            | 供应商             |                                  |

## 界面文案（Web 与 Android 的中文文案）

| English  | 中文   | 不要译作       | 备注                                  |
| -------- | ------ | -------------- | ------------------------------------- |
| provider | 服务商 | 供应商、提供商 | 只用于界面文案；文档正文保留 provider |
