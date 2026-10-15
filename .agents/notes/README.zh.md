# Agent Notes

[English](README.md) | 中文

这里只存放一种设计文档。**Agent Note** 记录影响本代码库的决策或提案——记录*为什么*以及*放弃了什么*，也就是代码和文档承载不了的部分。本文件定义 Agent Note 存放在哪里、什么时候写，以及[文件格式](#文件格式)。

## 目录布局与命名

每篇 Agent Note 有两个维度，都编码在它的**路径**中——`{lifecycle}/{class}/yyyy-mm-dd-topic-title.md`：

- **生命周期**（顶层目录）是 Agent Note 的状态；状态变化时，Agent Note 在目录之间移动：
  - **`proposed/`**——实现前接受评审的提案；尚未构建（或只构建了一部分）。
  - **`implemented/`**——决策已落地。文件记录决定了什么、否决了什么，并且**与实际落地的内容保持同步**：之后代码移动了文件、重命名了 crate、或修改了某个键或默认值时，在同一次改动中更新该 Agent Note 与之一致（只更新事实——路径、名称、结构——而不是决策本身）。见 [implemented/AGENTS.zh.md](implemented/AGENTS.zh.md)。
  - **`rejected/`**——提案经过考虑后被否决。只在其理由能防止一个诱人且有实际影响的错误时保留；否则删除这一对文件。
- **分类**（嵌套目录）是决策的*种类*——见下文[分类](#分类)。

每篇 Agent Note 是一对双语文件：`yyyy-mm-dd-topic-title.md` 与 `yyyy-mm-dd-topic-title.zh.md`，遵循[双语契约](../../docs/i18n/README.zh.md)。

文件名中的日期是该主题**首次提出**的日期（以 git 历史为准）。Agent Note 之间的交叉引用使用相对 Markdown 链接——绝不使用纯文字或编号——这样在目录之间移动后链接依然有效。

有效的生命周期目录树本身就是工作清单：浏览各生命周期与分类目录，或搜索仓库。不要添加集中的 `INDEX.md`：它重复了路径中的元数据，还会让互不相关的 note 改动在同一个文件上冲突。有历史决策价值、但对未来工作指导意义不大的已实现记录，移到下文所述独立且冻结的 `archived/` 目录树。

## 分类

每篇 Agent Note 属于下列封闭集合中的一个分类，分类编码在路径中。新增分类需要同时更新本节。

| 分类 | 涵盖内容 |
|---|---|
| `feature` | 新的面向用户或面向模型的能力。 |
| `bug-fix` | 修正缺陷，或补上 postmortem 暴露的缺口。 |
| `simplification` | 删除代码、行为或对外接口，且不新增能力。 |
| `architecture` | 关于**交付源码**的结构性决策——crate 之间如何关联、运行时的术语体系是什么。 |
| `process` | 代码**周边**的工具、策略或工作流——检查、工具链、发布流程——而不是运行时行为。 |
| `testing` | 测试基础设施与测试策略。 |

`architecture` 与 `process` 的分界：**architecture** 关乎我们交付的源码；**process** 关乎周边的工具与工作流。（有意不设 `refactor`——它与 `simplification` 重叠，而后者的判别标准“可观察行为是否改变？”已经覆盖了它。）

## 归档与删除

只描述细小 UI 调整或纯机械改动的已实现 Agent Note 应当删除；两个语言文件一起删除，并修复或移除指向它的链接。局部的 bug 修复、性能改动、新能力或实质性的行为决策，不会仅仅因为实现规模小就符合删除条件。其他已实现的 note 只有在以下条件同时满足时才归档：已落地的决策是完整的，其理由不太可能指导未来工作，且该记录仍有历史决策价值。当它的备选方案、所有权边界、否定性保证、持久化或线上传输语义、安全规则或重新引入条件仍然有用时，保持其有效。绝不归档提案状态的 note：过时的提案应当否决。被否决的 note 只在能防止一个看似合理的错误时保留；否则两个语言文件一起删除。使用经过校准的 `.agents/skills/lemma-archive-agent-notes/SKILL.md` 工作流做判断，而不是依据字数、时间长短或数量指标。

归档目录的路径编码为 `archived/{class}/yyyy-mm-dd-topic-title.md`；路径中有意不含 `implemented`，因为只有已实现的 note 才能进入归档。归档改动移动完整的一对文件，保留 `Status: implemented`，在两个语言文件中该状态行的正下方插入相同的 `Archived: YYYY-MM-DD` 行，并修复或删除指向它的链接。这些是归档时仅允许的内容改动。

归档完成后，每一对归档文件都永久冻结。不要编辑、翻译、重新排版、更新、移动或删除它，也不要把它当作当前行为的依据。有意引用历史时，有效文档中的文字仍可链接到归档的 note。

## 什么时候写

只在需要记录长期有效、且代码、测试与现有文档都无法说明的决策理由时，在同一个 PR 中新增或更新 Agent Note。针对重大未来工作的提案从 `proposed/` 开始；已经做出的决策从 `implemented/` 开始。选择与决策相符的分类目录（见[分类](#分类)）。

更新已经负责该决策的 Agent Note 即满足此规则；不要创建重复的 note。机械性或局部的改动，包括局部的 UI 展示与交互改动，无需 note。Agent Note 绝不会被改写成*另一个决策*：用一篇新 note 取代它，并保持两篇互相链接，除非旧 note 之后按下文规则被完全合并。为跟踪既有决策当前所在位置而编辑 `implemented/` 中的 Agent Note 是必需的，而不是被禁止的；见 [implemented/AGENTS.zh.md](implemented/AGENTS.zh.md)。

被完全取代的已实现 Agent Note 可以合并进当前负责的 note 后删除。删除前，负责的 note 必须保留旧 note 中每一条独有的理由、备选方案、后果、必需的验证与已点明的覆盖缺口；修复每一个指向它的链接；并在同一次改动中删除其中文对应文件。部分取代不符合条件：保持两篇互相链接，并更新其中仍然有效的每一条事实。合并不得把旧文件改写成相反的内容，也不得让 git 历史成为理由的唯一副本。

只有满足以下条件时，新增某项功能的 note 才能合并进之后删除该功能的 note：该功能已从生产代码、配置、schema、持久化或线上传输格式、迁移与兼容行为中完全移除；没有任何现行文档把它描述为可用；也没有任何测试把它作为受支持的行为来验证。删除的理由以及验证其已不存在的测试可以保留。负责删除的 note 需保留原始动机、它为何不再值得保留、完全删除之外的备选方案、放弃的能力、重新引入的条件，以及对其已完全移除的验证。只移除一种传输方式、一个默认值、一种实现或一种展示属于部分取代；任何仍留存的持久化数据或兼容处理也属于部分取代。

## 文件格式

每篇有效的 Agent Note 都遵循同一种文件格式。归档的 note 保留其封存时的格式，外加上述归档日期行。

### 头部

每篇 Agent Note 的开头几行严格为：

```markdown
# Agent Note: <title>

English | [中文](<file>.zh.md)

Status: <status>
```

其后紧跟一个空行。中文文件使用自己的语言切换行 `[English](<file>.md) | 中文`。`Status:` 的值为以下三种形式之一，并且必须与文件所在的生命周期目录一致：

- `Status: proposed`
- `Status: implemented`
- `Status: rejected — <why, in one line>`

状态行不含日期，也不含括号补充：文件名记录首次提出的日期，git 记录其余一切；“以修改后的形式采纳”属于正文内容（在陈述决策的位置说明修改）。否决理由是唯一带内容的状态，因为被否决的 Agent Note 的结论正是读者要找的事实。

### 正文骨架

每篇 Agent Note 的正文都以 `## Problem` 开头——陈述动机，并且脱离解决方案也能独立成立。后续内容取决于生命周期；反复出现的章节只使用以下规范名称，而真正特有的技术章节（crate 拓扑、线上传输契约、schema）可以自由地放在必需章节之间。

#### `proposed/`

```markdown
## Problem
## Proposal
…bespoke sections…
## Alternatives considered
## Acceptance criteria
## Risks
```

`## Proposal` 是计划中的改动，可以合理地使用将来时——工作尚未构建时，计划、迁移步骤与待解决的问题都放在这里。`## Acceptance criteria` 说明什么样的可观察状态算作完成。`## Risks` 既涵盖可能出错的地方，也涵盖该改动有意放弃的东西。

#### `implemented/`

```markdown
## Problem
## Decision
…bespoke sections…
## Alternatives considered
## Consequences
```

`## Decision` 用现在时描述已落地的实际情况，整个文件按 [implemented/AGENTS.zh.md](implemented/AGENTS.zh.md) 与之保持同步。`## Consequences` 记录这项权衡付出了什么代价，**以及**换来了什么。提案阶段的标题在这里属于规格腔：`## Proposal`、`## Plan`、`## Migration plan` 与 `## Acceptance criteria` 不得出现在已实现的 Agent Note 中（[slop 清单](../../docs/AGENTS.zh.md#slop-清单)说明了原因）。陈述现时事实的 `## Testing`、`## Deferred` 或 `## Related` 章节是允许的。

#### `rejected/`

被否决的 Agent Note 就是被冻结的提案：它保留提案阶段已有的所有章节（包括 `## Acceptance criteria` 或 `## Plan`），结论写在 `Status:` 行上。只有头部、开头的 `## Problem`、`## Proposal` 章节以及下文的备选方案强制要求适用于它。

### 备选方案——必填

每篇 Agent Note 都包含 `## Alternatives considered` 章节：列出每个真实存在的备选方案及其落选原因，每个备选方案一段、以粗体开头，或者每个有争议的方案一个 `### Why not <X>?` 小节。只记录决策、不记录它胜过了什么，会招致反复争论——而这正是 Agent Note 要防止的失败。备选方案只能如实记录，绝不能虚构。

### 在生命周期之间移动

在生命周期目录之间移动文件，意味着在同一次改动中更新 `Status:` 行，并重新满足目标目录的骨架要求。具体来说，`proposed/` → `implemented/` 要把 `## Proposal` 改写为现在时的 `## Decision`，把 `## Acceptance criteria` 与 `## Risks` 并入 `## Consequences`（或者并入一个现在时的 `## Testing`/`## Verification` 章节，说明现在由什么来固定该行为），并用实际落地的内容替换计划——这正是 [implemented/AGENTS.zh.md](implemented/AGENTS.zh.md) 要求的改写，只是变成了机械步骤。`proposed/` → `rejected/` 只需在 `Status:` 行加上理由，然后冻结文件。

### 中文对应文件

`.zh.md` 对应文件按[双语契约](../../docs/i18n/README.zh.md)逐节镜像其英文同级文件的结构。头部标记 `# Agent Note: ` 与 `Status: ` 以及状态关键词（`proposed`、`implemented`、`rejected`）原样保留英文；规范章节标题翻译为中文。
