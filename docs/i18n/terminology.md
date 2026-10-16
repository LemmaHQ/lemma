# Terminology

本表约定本仓库文档的中英术语统一译法，两个翻译方向都以它为准。术语在代码中的含义见 [glossary.md](../glossary.md)。

**通用规则：**

- "中文"列为中文正文的用词。若该列为英文，则中文正文保留英文不翻译。
- "不要译作"列为禁止的译法。
- 英文类术语在正文中小写；位于标题、表格单元格、段落或加粗引导语开头时首字母大写。
- 代码标识符、命令、路径与代码块中的代码保持原样，不适用本表。
- 本表未列出的术语，先沿用周围文档已有的译法；没有先例时保留英文，并在提交说明中列出，待加入本表。

## 缩写类（中英文文本中均使用缩写）

| English | 中文 | 不要译作 | 备注 |
|---|---|---|---|
| API | API | | |
| CI | CI | | |
| CSS | CSS | | |
| JWT | JWT | | |
| LLM | LLM | 大模型 | |
| RPC | RPC | | |
| UI | UI | | 组合词写作 `Web UI`、`UI 规则` |
| URL | URL | | `base URL` 保留英文 |

## 英文类（中英文文本中均使用英文）

| English | 中文 | 不要译作 | 备注 |
|---|---|---|---|
| agent | agent | 智能体、代理 | |
| commit message | commit message | 提交消息 | 指文本本身；动作与提交对象写作"提交" |
| crate | crate | 包、箱 | |
| fixture | fixture | | |
| mock | mock | 模拟 | 指测试替身 |
| provider | provider | 供应商、提供商 | 文档正文中指用户配置的模型端点；界面文案见下方"界面文案" |
| recipe | recipe | 配方 | 指 `justfile` 中的命令 |
| skill | skill | 技能 | |
| step | step | 步骤 | agent 循环中的一次模型请求 |
| token | token | 令牌、标记 | 指设计 token 与模型用量 token；认证用的 token 见"访问令牌" |
| trait | trait | 特征、特质 | |
| turn | turn | 轮次、回合 | 由一条用户消息启动的工作 |
| workspace | workspace | | 指 Cargo 与 npm 的 workspace；`workspaces/<conversation id>` 工具目录写作"工作区" |

## 中文类（中文文本中使用中文）

| English | 中文 | 不要译作 | 备注 |
|---|---|---|---|
| access token | 访问令牌 | | |
| adapter | 适配器 | | |
| alert dialog | 确认对话框 | 警告框 | `AlertDialog` 组件 |
| approval policy | 审批策略 | | |
| branch | 分支 | | 消息树中的分支 |
| canvas | 画布 | | |
| composer | 输入框面板 | 编辑器 | 会话页底部的消息输入区 |
| control | 控件 | | |
| conversation | 会话 | 对话 | 界面上新建会话的操作与 chat 消息可写作"对话" |
| elevation | 层级 | 海拔、高度 | |
| hairline | 细线 | 发丝线 | |
| leaf | 叶子 | | |
| local engine | 本地引擎 | | |
| message | 消息 | | |
| overlay | 浮层 | 覆盖层 | |
| pair | 配对 | | 一组中英文对照文件 |
| palette | 色板 | 调色板 | |
| primitive | 原语 | | Radix 原语 |
| reference | 参考 | | 文档类型 |
| semantic alias | 语义别名 | | |
| theme | 主题 | | |
| toast | 提示消息 | 吐司 | `sonner` 的 `toast` |
| tool | 工具 | | |
| tooltip | 工具提示 | 提示、气泡提示 | `Tooltip` 组件 |
| tutorial | 教程 | | 文档类型 |
| type role | 字体角色 | | |
| utility class | 工具类 | 实用类 | Tailwind 工具类 |
| variant | 变体 | | 组件变体与 Rust 枚举变体 |
| vendor | 厂商 | 供应商 | 模型 API 的提供方 |

## 界面文案（Web 与 Android 的中文文案）

| English | 中文 | 不要译作 | 备注 |
|---|---|---|---|
| provider | 服务商 | 供应商、提供商 | 只用于界面文案；文档正文保留 provider |
