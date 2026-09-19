# 统一功能目录（docs/features/）：机器可读的能力清单与各端同步机制

## 背景与动机

各端（web / desktop / android）功能边界与进度目前靠 PRD 式文档与记忆维护，无单一事实源，无法回答"某功能各端做到哪了"，也无法校验"各端行为是否一致"。

参考 KEP 的治理模型（元数据 + 生命周期 + CI 校验）与 Spec Kit 的工件分层（WHAT / HOW / 验收），但按 Lemma 实际裁剪：瞬态工件（计划、任务）不入目录，走现有 docs/plans 与 org project 板；验收场景人读机读合一，不双写。

## 目录布局

```
docs/features/
  README.md                      # 元规范：schema 说明、生命周期、写作语法
  _template/                     # 新 feature 复制起点（校验跳过）
    feature.yaml
    spec.md
    scenarios/happy-path.yaml

  <slug>/                        # 目录名 = feature id
    feature.yaml                 # 唯一事实源：身份 / 状态 / 各端矩阵
    spec.md                      # WHAT：RFC 2119 约束 + EARS 需求条目
    design.md                    # HOW：当前实现决策（可过时，过时即重写）
    decisions/                   # 可选：不可逆取舍，MADR 格式，只增不改
    scenarios/                   # 验收场景：Gherkin 语义，YAML 载体

scripts/
  check-features.mjs             # 校验：schema + id↔目录一致 + 状态闭集 + 引用完整性
docs/
  feature-matrix.md              # 生成物：各端能力矩阵（入 git，CI 校验同步）
```

## 各文件职责

| 文件 | 职责 | 变化频率 |
|---|---|---|
| `feature.yaml` | 唯一事实源：id、status、各端 status/since/inherits、关联 proto/issue | 低频，改动走 PR |
| `spec.md` | 行为契约（WHAT）。稳定后视为契约，不含实现细节 | 低频 |
| `design.md` | 当前实现方案（HOW）。允许过时，不维护历史 | 中频 |
| `decisions/NNNN-*.md` | 不可逆取舍（为什么选 A 不选 B）。有真实取舍才建 | 极低，只增不改 |
| `scenarios/*.yaml` | 验收场景（WHAT COUNTS AS CORRECT）。第一阶段人读，不接 runner | 低频 |
| `README.md` | 元规范本身 | 极低 |

瞬态工件（本次落地怎么排、谁做什么）不进 features/：计划走 docs/plans，任务走 issue + project 板，feature.yaml 以 `links` 指向。

## feature.yaml schema

```yaml
id: offline-sync               # MUST 等于目录名
title: Offline Synchronization
status: in-progress            # draft | approved | in-progress | done | deprecated
owners: [core]
api:
  proto: [lemma.sync.v1]       # 可选；声明的 package 必须存在
clients:
  web:     { status: supported, since: "0.8.0" }
  desktop: { status: inherited, inherits: web }
  android: { status: partial, since: "0.9.0", tracking: 123 }
links:
  plan: docs/plans/2026-09-19-offline-sync.md   # 可选，文件必须存在
```

- 全局 `status` 闭集：`draft / approved / in-progress / done / deprecated`（单一生命周期轴，不设独立 maturity 字段）。
- per-client `status` 闭集：`planned / in-progress / partial / supported / inherited / n/a`。
- `inherited` 必须填 `inherits`；非 `inherited` 禁止填。
  desktop（Electron 封装 web）默认 inherited。
- `n/a` 显式标注天然不适用端，与"未填"区分。

## 写作语法分工

- RFC 2119（MUST/SHOULD/MAY）：规范级约束。
- EARS（`WHEN <trigger> THE SYSTEM SHALL <response>`）：逐条需求，spec.md 主体。
- Gherkin（Given/When/Then）：验收场景，以 YAML 承载于 scenarios/。

规格正文用英文（仓库 public）。
spec.md 从短写起，10 行需求条目即合格。

## 校验（check-features.mjs）

第一阶段检查项（`yaml` 解析 + 手写断言，新 devDependency 仅 `yaml`）：

1. 每个 `docs/features/<slug>/feature.yaml` 可解析且符合 schema；
2. `id` 与目录名一致；
3. status 取值在闭集内；`inherited` ↔ `inherits` 不变量；
4. `links.plan` 指向的文件存在；`api.proto` 声明的 package 在 proto/ 中存在；
5. `_template/` 跳过。

后续增量（非本轮）：生成 `docs/feature-matrix.md` 并 CI 校验同步；`tracking` issue 存在性联网校验。

## 实施阶段

**本轮（Phase 1）**：

1. 建 `docs/features/README.md`（元规范）与 `_template/`；
2. `scripts/check-features.mjs` + just recipe + CI job。

样例回填不在本轮：后续 refactor 开工时随做随填。

**后续（不在本轮）**：

- Phase 2：矩阵 dashboard 生成；scenarios 格式稳定后为一条核心链路写 scenario runner 接入 Rust 侧测试；
- Phase 3：web/android 侧消费 scenarios，per-client status 由测试结果回填。

## 验收

1. `just check-features` 对仅含 `_template` 的目录全绿（模板跳过校验）；
2. 临时构造三种错误（schema 错 / id 与目录不一致 / inherited 缺 inherits）脚本均报错，验证后删除临时目录；
3. `_template` 复制后仅改 id 与 title 即通过校验，证明模板可用。

## 非目标

- 不做 plan.md / tasks.md 入目录（瞬态工件归 docs/plans 与 project 板）；
- 不做 acceptance.md（与 scenarios 双写必漂移，scenarios 是唯一载体）；
- 不做 feature 数字编号（目录 slug 即 id）；
- 本轮不写 scenario runner，scenarios 仅作人读文档；
- 本轮不回填任何存量功能实例。
