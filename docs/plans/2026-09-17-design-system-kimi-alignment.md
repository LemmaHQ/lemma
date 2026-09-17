# 设计系统向 Kimi 体系对齐计划

日期:2026-09-17
前置:`docs/plans/2026-09-17-kimi-design-extraction.md`(提取报告,数值真值来源)
范围:DESIGN.md 重写 + web 生成器/手写层/组件联动;KMP 主题层另行立项。

## 已批准的决策

1. 品牌主色 `#60b1ff` → `#1783ff`(Kimi KMBlue light),暗色 `#1a88ff`;web 与 Android 两端同时生效。
2. web 同步换肤:一份 DESIGN.md,两端共用,不设平台分支。
3. 删除暗色画布渐变(`dark-canvas-from`/`dark-canvas-to`),设计系统回归全扁平。
4. 毛玻璃只做语义层:DESIGN.md 定义 glass = 主背景 × 84% alpha + 发丝边框;web 手写层用 `backdrop-filter` 实现,Android v1 用半透明实色,Kyant backdrop 留作 KMP 评估项。
5. 字体:Android UI 拉丁用 MiSans(官方渠道获取,子集化授权待核实),代码用 MapleMono TTF;web 字体不动。本条属 KMP 阶段,本计划不执行。
6. 其余 Kimi token 体系(Labels/Fills/Separators 透明度梯度、功能色、动效梯度)整体采纳。

## DESIGN.md 改动

### 色彩:新 token 结构

沿用现有 Tailwind 语义 token 名(组件零改名),值全部换真值;新增 Kimi 特有组。

| Token | Light | Dark | 来源 |
|---|---|---|---|
| primary | `#1783ff` | `#1a88ff` | KMBlue |
| primary-foreground | `#ffffff` | `#ffffff` | 反白 |
| ring | `#1783ff66` | `#1a88ff66` | primary 40% alpha(惯例保持) |
| destructive | `#ff3849` | `#ff4756` | Colors-Red |
| success | `#16c456` | `#32ff7d` | Colors-Green |
| warning | `#ff9500` | `#ff9f0a` | Colors-Orange |
| background | `#ffffff` | `#121212` | Bg-Primary |
| card | `#ffffff` | `#1f1f1f` | Bg-Secondary/BgGp |
| popover | `#ffffff` | `#1f1f1f` | 同上 |
| sidebar | `#f5f5f5` | `#000000`? | **待定**:Kimi 无独立 sidebar 色;候选 = Bg-Secondary(`#f5f5f5`/`#1f1f1f`)或保留纯黑侧栏 |
| composer | `#ffffff` | `#1f1f1f` | 卡片级 |
| foreground | `#000000e6` | `#ffffffd6` | Labels-Primary |
| muted-foreground | `#00000099` | `#ffffff8f` | Labels-Secondary |
| tertiary-foreground(新增) | `#00000073` | `#ffffff6b` | Labels-Tertiary |
| border | `#00000021` | `#ffffff1f` | Separators-S1(13%/12%) |
| secondary / muted / accent(填充) | `#0000000d` / `#00000008` / `#0000000d` | `#ffffff1a` / `#ffffff0d` / `#ffffff1a` | Fills F2/F1/F2 |
| glass(新增) | `#ffffffd6` | `#121212d6` | Bg-Primary × 84% |
| code / code-border | 维持现值,按新底色微调 | 同左 | 局部校准 |

删除:`dark-canvas-from`、`dark-canvas-to`。

正文同步:§Surface 重写为"全扁平 + 透明度层级";删渐变相关 4 处叙述(L341-342、L350-351、L368-370、L469-470);description 更新;Known Gaps 移除渐变条目、追加"glass 目前仅 web 真模糊"。

### 动效:新增 motion 段(采纳 Kimi 整组)

```yaml
motion:
  duration: { micro: 60ms, fast: 120ms, normal: 200ms, slow: 300ms, popover: 140ms, dialog: 180ms, dialog-exit: 135ms, panel: 240ms, list: 180ms }
  easing:
    standard: cubic-bezier(0.4, 0, 0.2, 1)
    out: cubic-bezier(0, 0, 0.2, 1)
    in: cubic-bezier(0.4, 0, 1, 1)
    motion-out: cubic-bezier(0.23, 1, 0.32, 1)
    panel: cubic-bezier(0.32, 0.72, 0, 1)
```

### 不动项

字阶(12~24 七级 vs Kimi 六级,已对齐)、圆角(10/12/16 完全一致)、字体声明、密度哲学、组件结构。

## 生成器改动(gen-tokens.mjs)

1. motion 段 → `--motion-*` / `--ease-*` CSS 变量输出;
2. glass 等新增 token 进模板;
3. 8 位 hex 原样透传(无需换算,CSS 原生支持);
4. prettier 门禁保持绿,产物 md5 回归对比记录。

## web 手写层改动(theme.css / index.css)

1. 删除 `.app-canvas` 整条规则(含中文注释);
2. 滚动条颜色改引用新 Separators 等价 token;
3. 新增 `.glass` 工具规则: `background: var(--glass); backdrop-filter: blur(20px) saturate(1.5);`,顶栏/浮层组件后续按需接入(本计划只交付规则,不逐组件改造);
4. `theme.inline` 无需变更(token 名不变,值由 tokens.css 承载)。

## 组件改动(最小化)

- `ChatPage.tsx:225`、`ProvidersPage.tsx:54,58,72`:`app-canvas` → `bg-background`(4 处);
- 其余组件零改动(token 名未变)。

## 验证

1. `npx designmd lint DESIGN.md`:0 err,warning 数与 41 基线比对并记录新基线;
2. 删 tokens.css 后 `just web-build`:prebuild 钩子再生成 + 构建全绿;
3. `npm run format:check -w web` 全绿;
4. 浏览器实测(Chromium,两态):背景计算值 light `#ffffff` / dark `#121212`;`--primary` 计算值 `#1783ff` / `#1a88ff`;渐变消失;滚动条、边框、文字层级渲染正常;
5. web 单测 59 例全过;
6. git status 核验,逐文件 add,单笔提交。

## 明确不做

- 不引入 Kyant backdrop / Rive;
- 不改字体(web 保持 Sarasa + MapleMono);
- 不动 KMP 工程(主题层另行立项);
- 不逐组件接入 glass(只交付规则);
- 不抄 Kimi 图形/字体资产。
