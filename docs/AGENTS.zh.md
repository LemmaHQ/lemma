# AGENTS.md — 文档标准

[English](AGENTS.md) | 中文

本文件定义 Lemma 的文档结构、Markdown 分层、写作规则与字数预算。归属判断与校验使用 [lemma-doc](../.agents/skills/lemma-doc/SKILL.md)，必需的覆盖面与编辑判断使用 [lemma-prose-standard](../.agents/skills/lemma-prose-standard/SKILL.md)。[双语契约](i18n/README.zh.md)定义中英文配对的维护方式。

## 文档结构

这些规则适用于面向人类的文档。文档的主题与它在目录树中的位置决定其范围：以恰当的粒度阐述自身主题，对直接子级只介绍用途、职责与高层行为；更低层级的细节链接到对应的下级文档。文档类型不会扩大这一范围。参考文档只能对自身主题做穷尽描述。测试机制、fixture 与测试框架归属于最低的所属层级，更高层级的文档链接过去。

将每份在范围内的文档归为教程或参考。教程沿一条有序路径通向一个结果，只引入每一步所需的内容。参考界定查阅范围并描述当前行为，不带教学顺序。篇幅较大的教程内容与参考内容分开存放；其中一部分篇幅很小时，为该部分单独标注一节。

动笔写教程前，先在心里把读者的起点知识和每个概念分级为初级、中级或高级。先建立前置知识，再引入依赖它的概念，难度逐步递增，并把不必要的高级内容移到后续教程或参考中。

按以下顺序撰写：确定文档在目录树中的位置；设定其允许的粒度；选择教程或参考；如果是教程，按前置关系与难度排列概念；把属于下级的细节迁移出去；用指向其归属的链接替换低层级的解释。

## 分层体系：每条事实一个归属

每条事实只有一个归属，即以它为职责的那一层；其他位置链接过去。

| 层 | 职责 | 不应放在这里 |
| --- | --- | --- |
| 根 `AGENTS.md` | 常驻规则：agent 每次会话都需要放在上下文中的规则，每条一至三行，并链接到其归属 | 故事、完整示例、场景化流程，以及从已链接归属处复述的任何内容 |
| 子树 `AGENTS.md`（`crates/`、`web/`、`desktop/`、`mobile/`、`proto/`、`docs/`） | 仅作用于该子树的规则 | 根文件已经包含的全仓库规则 |
| [architecture.md](architecture.zh.md) | 有序的系统地图：crate 分层、服务端与本地两种模式、一次 turn 的完整链路、扩展点；修改 `crates/` 前阅读 | 类型定义（→ subsystems）、单个 crate 的细节（→ crate README）、决策理由（→ commit message）、实现进度标注 |
| [glossary.md](glossary.zh.md) | 在代码中有确切含义的术语，每个术语一条定义 | 行为叙述（→ architecture.md）、类型定义（→ subsystems） |
| `subsystems/` | 每个子系统一页参考：类型定义、语义、不变量 | 跨子系统的行为叙述（→ architecture.md） |
| Crate 与 package README | 单个 crate 的契约：配置、语义、限制、扩展点 | 对文档注释的复述、其他 crate 的事务 |
| [development.md](development.zh.md) | 环境搭建、日常工作流与 CI 概览 | 运行时与版本选择的理由（→ commit message）、会与 `justfile` 脱节的逐项检查列表 |
| [testing.md](testing.zh.md) | 测试分层：各层覆盖什么、测试放在哪里、如何运行 | 单个测试的走查、归属于某个 crate 或 package 的 fixture 细节 |
| [design/README.md](../design/README.zh.md) 与 `tokens.json` | 设计 token 取值及其格式：静态色板、各主题的语义别名、字体排版、圆角、动效；生成器的输出与检查 | 使用规则（→ [web-styling.md](web-styling.zh.md)） |
| [web-styling.md](web-styling.zh.md) | Web 客户端的样式归属、组件规则与视觉体系 | token 取值（→ `design/tokens.json`）、圆角规则（→ [ui-radius.md](ui-radius.zh.md)）、组件清单（→ [web/src/components/ui/README.md](../web/src/components/ui/README.zh.md)） |
| [ui-radius.md](ui-radius.zh.md) | Web 客户端的圆角角色、嵌套与悬停几何 | token 取值（→ `design/tokens.json`） |
| Skill（`.agents/skills/`） | 可复用的工作流与专项决策标准，包括各语言的代码风格 | 产品与运行时契约（→ 文档或源码） |

归属规则：决策理由 → commit message；类型定义 → subsystems；术语定义 → glossary；crate 契约 → README；代码风格与工作流 → skill；常驻规则 → 根 `AGENTS.md`。

## 写作规则

- **描述当前状态。** 历史保留在 commit 中。其余文字描述现行机制，而不是变更过程或在提交栈中的位置。
- **每段占一个物理行**：依靠编辑器软换行。代码块、表格与列表结构保持各自的格式。
- **所属的 subsystems 页面在同一次改动中更新**，只要该改动调整了已文档化的类型。
- **配对文件同步更新**：修改任一语言时，先加载 [terminology.md](i18n/terminology.md)，在同一次提交中更新其对应文件并重新记录这对文件（[双语契约](i18n/README.zh.md#更新一对文件)）。
- **文档注释陈述完整契约，而不是推理过程。** `//!`、`///`、JSDoc 与 KDoc 保留行为、失败、时序、所有权与后果；删除叙述、测试走查、评审分析与对代码的复述。保留局部契约，并链接到其理由。细则见 [lemma-prose-standard](../.agents/skills/lemma-prose-standard/SKILL.md)。
- **直接表达**：点明主体与事实。用确切的检查、类型、API、操作或行为，而不是比喻性的“gate”“vocabulary”“surface”。

## 字数预算

目标：根 `AGENTS.md` ≤ 1,500；本文件 ≤ 1,200；其他子树 `AGENTS.md` ≤ 500；[architecture.md](architecture.zh.md) ≤ 2,400。预算按英文文件的词数计算。其他层不设预算。

文档超出预算时：

1. **迁移**属于其他层的内容；需要时在原处保留一行链接。
2. **压缩**属于本层但可以更短的内容。
3. 只有内容确实需要更多篇幅时才**上调**预算，并在 commit message 中说明理由。预算设得过低本身就是预算的缺陷。

预算是护栏，不是削减目标。

## Slop 清单

在任何文档中排查以下问题；[lemma-doc](../.agents/skills/lemma-doc/SKILL.md) 以此清单作为审计项：

- 重复的规则：搜索一个有辨识度的短语；保留一处归属，其余位置改为链接。
- 出现在允许层级之外的历史：陈述当前事实，并链接到历史的归属。
- 正文或图表中的实现进度标注（“已实现！”“未来：…”）。进度会过时；它由 issue 与项目看板承载。
- 在源码或生成器才是权威来源时，手工复述的目录、文档注释，或测试、crate 与进度的清单。
- 推理过程：逐步的实现叙述、对显而易见分支的证明、测试走查，或被否决的局部备选方案。保留得出的契约或长期有效的理由；删除推导的路径。
- 在同级函数旁重复书写理由，而不是在所属的能力或辅助函数处写一次。
- 段落墙：一个段落承载多条规则和括号补充。拆分它，或把细节下放到其归属。
- 强调泛滥：到处都是粗体、大写或“至关重要”，就没有任何内容突出。强调只用于改变行为的那一句。

## 仓库引用

已存在的文件使用相对 Markdown 链接，计划中的文件使用代码格式的路径。计划中的文件落地时，在仓库中搜索其路径，并在同一次改动中把所有代码格式的引用改为链接。历史引用使用 tag，不使用 commit 标识。
