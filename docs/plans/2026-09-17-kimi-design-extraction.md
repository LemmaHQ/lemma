# Kimi 3.1.0 设计系统提取报告

来源:`tmp/kimi_3.1.0.apk`(35.7 MB,3 dex,arm64),jadx 1.5.6 反编译至 `tmp/jadx-kimi/`。
本文档是移动端(KMP/Compose)设计的参考底稿,所有数值均可溯源到反编译产物。

## 1. 目标应用技术分析

| 项 | 结论 | 证据 |
|---|---|---|
| UI 技术栈 | Compose Multiplatform(KMP shared 模块) | `assets/composeResources/kimi.shared.generated.resources/`、`com.moonshot.kimichat.shared.generated.resources` |
| 混淆状况 | App shell 未混淆(`com.moonshot.kimichat.{chat,ui,auth,common}` 包名完整);shared KMP 模块被 R8 混淆(`aa`/`ab0` 式包名) | `tmp/jadx-kimi/sources/` 包结构 |
| 设计 token 真值 | 以 CSS 变量形式完整交付在 widget foundation 中 | `resources/assets/composeResources/kimi.shared.generated.resources/files/widget_foundation.css` |
| 原生资源佐证 | `res/values/colors.xml` 中 app 自有颜色与 CSS token 精确吻合 | 见 §2.6 |
| 特效依赖 | Kyant 系列:backdrop(毛玻璃)、highlight、shadow;Rive 运行时动画 16 个 | `sources/com/kyant/`、`files/*.riv` |
| 字体资产 | MiSans Latin(Regular/Medium/Demibold)、Geist Mono(Regular/Italic)、Pixelify Sans | `composeResources/.../font/` |

对移动端的直接意义:Kimi 安卓端与我们 `kmp/` 客户端同栈(KMP + CMP),其设计系统的组织方式(语义分层 + 别名)可直接对照复刻,无需跨范式翻译。

## 2. 色彩系统

结构为四层:**Colors(品牌/功能色)→ 语义组(Bg/Labels/Fills/Separators/MaskBg/Others/Chart)→ 组件别名(--kimi-*)→ 兼容别名(--color-*)**。暗色模式仅覆盖真值层,别名自动跟随——与我们 DESIGN.md → tokens.css 的单源管线同构。

### 2.1 Colors(品牌与功能色)

| Token | Light | Dark |
|---|---|---|
| KMBlue(品牌主色) | `#1783ff` | `#1a88ff` |
| KMBlue-hover | `#167ff7` | `#258eff` |
| Red(危险) | `#ff3849` | `#ff4756` |
| Green(成功) | `#16c456` | `#32ff7d` |
| Yellow(警示-黄) | `#ffd230` | `#ffd230`(不变) |
| Orange(警示-橙) | `#ff9500` | `#ff9f0a` |
| Purple | `#985ffb` | `#a16bff` |

特征:暗色下所有功能色做**提亮微调**(Hue 不变、提高明度),保证在 `#121212` 底上的对比度;Yellow 两态相同。

### 2.2 Bg(背景层级)

| Token | Light | Dark | 用途 |
|---|---|---|---|
| Bg-Primary | `#ffffff` | `#121212` | 主背景 |
| Bg-Primary-hover | `#f7f7f7` | `#1e1e1e` | 主背景悬停 |
| Bg-Secondary | `#f5f5f5` | `#1f1f1f` | 次级背景(分组底色) |
| BgGp-Secondary | `#ffffff` | `#1f1f1f` | 分组内卡片背景 |
| BgGp-Secondary-hover | `#f7f7f7` | `#2a2a2a` | 分组卡片悬停 |

特征:iOS 分组列表式三级背景体系;暗色主背景 `#121212`(Material 暗色惯例),次级仅 +7 明度阶(`#1f1f1f`),层级靠**微弱明度差**而非边框。

### 2.3 Labels(文字透明度层级,核心手法)

| Token | Light | Dark |
|---|---|---|
| Labels-Primary | 黑 90% (`#000000e6`) | 白 84% (`#ffffffd6`) |
| Labels-Secondary | 黑 60% (`#00000099`) | 白 56% (`#ffffff8f`) |
| Labels-Tertiary | 黑 45% (`#00000073`) | 白 42% (`#ffffff6b`) |
| Labels-Quaternary | 黑 27% (`#00000045`) | 白 28% (`#ffffff47`) |

括号内为等值 8 位 hex(alpha 经四舍五入;原生 colors.xml 实测值 `#e5000000`/`#d6ffffff`,0.9 被截断为 0xE5)。

这是整个系统最关键的手法:**文字颜色不用独立色板,而用黑/白的透明度梯度**。收益是文字在任何底色上自动调和(尤其暗色下观感统一),且 hover/active 只需微调透明度(Primary-hover: light `#252525`、dark 白 84.8%)。

### 2.4 Fills(填充层级)

| Token | Light | Dark |
|---|---|---|
| F1 / F1-hover / F1-active | 黑 3% / 6% / 7.9% | 白 5% / 8% / 14.5% |
| F2 / F2-hover / F2-active | 黑 5% / 7.9% / 9.8% | 白 10% / 14.5% / 19% |
| F3 | 黑 15% | 白 18% |
| F4 | 黑 25% | 白 25% |

用于卡片填充、输入框底、tag 底等"不喧宾夺主的容器"。交互三态梯度规律:hover ≈ base +3~5 个百分点,active 再 +2~5。

### 2.5 Separators / MaskBg / Others

| Token | Light | Dark |
|---|---|---|
| Separators-S1(分割线) | 黑 13% | 白 12% |
| MaskBg-Icon(图标遮罩) | 黑 30%,hover 50% | 黑 45%,hover 65% |
| BubbleGray_PC(气泡灰) | `#f5f5f5` | `#292929` |
| KMBlue10(品牌色浅底) | KMBlue 10% | KMBlue 10% |
| LightRedBg / LightGreenBg / LightOrangeBg / LightYellowBg | 对应功能色 10%(Yellow 20%) | 同左 |
| Always-White | `#ffffff` | `#ffffff` |

浅色警示底 = 功能色 × 10% alpha,是标签/徽标背景的通用配方。

### 2.6 原生资源交叉验证

`res/values/colors.xml` 中 app 自有项(其余为 Material 库默认值):

| 名称 | 值 | 对应 CSS token |
|---|---|---|
| `lightLabelsPrimary` | `#e5000000` | Labels-Primary light(黑 90%)✓ |
| `labelsPrimary` | `#d6ffffff` | Labels-Primary dark(白 84%)✓ |
| `lightBgPrimary` | `#ffffffff` | Bg-Primary light ✓ |
| `bgTertiary` | `#ff262626` | 暗色第三级背景(CSS 未列出) |
| `blue_450` | `#3375ff` | 品牌蓝色阶中间值(CSS 未列出) |
| `colorAccent` | `#39a6ff` | 系统主题 accent(浅蓝变体) |

结论:CSS token 表与原生实现同源,可作为全端设计真值引用。

## 3. 字体与排版

### 3.1 字体资产

| 字体 | 字重 | 许可 | 用途推断 |
|---|---|---|---|
| MiSans Latin | Regular / Medium / Demibold | 免费可商用 | 拉丁文 UI 主体 |
| Geist Mono | Regular / Italic | OFL | 代码块 |
| Pixelify Sans | Regular | OFL | 装饰性像素字(彩蛋/品牌化场景) |

CJK 部分未内置中文字体资产,推断走系统字体回退(CSS font stack:`Inter, -apple-system, "SF Pro Text", "Segoe UI", Roboto, ...`)。注:资产不可直接搬运,需从官方渠道另行获取。

### 3.2 字阶(markdown 内容渲染)

| Token | 字号/行高 | 用途 |
|---|---|---|
| markdown-H1 | 20 / 32 | 对话内一级标题 |
| markdown-H2 | 18 / 28 | 二级标题 |
| markdown-B1 | 16 / 26 | 正文 |
| markdown-B3 | 14 / 22 | 辅助正文 |
| markdown-code | 14 / 22 | 行内/块级代码 |
| ui-B1 | 15 / 22 | UI 界面正文 |

特征:字阶克制(6 级),行高比 1.44~1.6,正文 16/26 是锚点;UI 文字(15)与内容文字(16)分离——与 DESIGN.md 现有 body-md 16/body-sm 14 的结构一致。

## 4. 圆角

| Token | 值 | 来源 |
|---|---|---|
| kdc_corner_medium | 10dp | `res/values/dimens.xml` |
| kdc_corner_normal | 12dp | 同上 |
| kdc_corner_large | 16dp | 同上 |
| 滚动条滑块 | 4px(= 滑块宽 8px 的半圆) | CSS |

10/12/16 三级,与 DESIGN.md 现有 rounded md 10/lg 12/xl 16 惊人一致,可直接对齐。

## 5. 动效规范

### 5.1 时长梯度

| Token | 值 | 场景 |
|---|---|---|
| t-micro | 60ms | 微反馈 |
| t-fast | 120ms | 快速过渡 |
| t-normal | 200ms | 常规过渡 |
| t-slow | 300ms | 慢速强调 |
| motion-popover | 140ms,偏移 4px | 浮层弹出 |
| motion-dialog | 180ms(退出 135ms) | 对话框 |
| motion-view | 180ms | 视图切换 |
| motion-panel | 240ms | 面板滑入 |
| motion-list | 180ms | 列表项 |

规律:**进入慢、退出快**(dialog 180/135);浮层类集中在 140~240ms 窄带内。

### 5.2 缓动曲线

| Token | 值 | 语义 |
|---|---|---|
| ease-standard | `cubic-bezier(0.4, 0, 0.2, 1)` | Material standard |
| ease-out | `cubic-bezier(0, 0, 0.2, 1)` | Material decelerate |
| ease-in | `cubic-bezier(0.4, 0, 1, 1)` | Material accelerate |
| ease-motion-out | `cubic-bezier(0.23, 1, 0.32, 1)` | 强回弹感出场 |
| ease-motion-panel | `cubic-bezier(0.32, 0.72, 0, 1)` | 面板专用,快速起步柔和落停 |

另有 `prefers-reduced-motion` 全局降级(时长压至 0.01ms),无障碍意识完整。

## 6. 组件与技术观察

- **毛玻璃**:引入 Kyant backdrop 库,顶栏/浮层大概率使用实时模糊;我们 CMP 端可评估同库(纯 Compose,与 CMP 兼容)。
- **滚动条规范**:8px 宽、4px 圆角、颜色用 Separators-S1、hover 升至 Labels-Tertiary——与 DESIGN.md 现有滚动条规则思路一致,颜色引用可借鉴。
- **Rive 动效**:加载态与工具图标全部矢量化编程动画,非静态图;移动端实现时可先用静态矢量 + Compose 动画替代,不引入 Rive 运行时。
- **widget 容器**:内联卡片外边距 8px(body padding),`font-synthesis: none` 禁合成粗斜体。

## 7. 与 Lemma DESIGN.md 现状的对比

| 维度 | Lemma 现状 | Kimi | 评估 |
|---|---|---|---|
| 品牌主色 | `#60b1ff`(亮蓝) | `#1783ff`(正蓝) | 色相接近,Kimi 更饱和;换不换属品牌决策 |
| 文字层级 | 实色 hex(`#16181d`/`#5f636a`…) | 黑/白透明度梯度 | Kimi 方案在暗色与多底色场景更系统,**建议借鉴** |
| 填充/分割 | 实色(`#f2f3f5`/`#dfe1e5`) | 透明度 F1–F4 / S1 | 同上 |
| 圆角 | 10/12/16(+pill) | 10/12/16 | 已对齐,无需动 |
| 字阶 | 12~24 七级 | 14~20 六级 | 已对齐,无需动 |
| 暗色策略 | 独立色板 | 提亮微调 + 透明度复用 | Kimi 维护成本更低 |
| 动效 | 未定义 | 完整时长/缓动体系 | **建议整组采纳** |

## 8. 落地建议(待决策)

1. **文字/填充/分割三层改为透明度 token**:用 8 位 hex(`#000000e6`)表达,不违反 DESIGN.md 的 hex-only 规则;收益是明暗两态与任意底色自动调和。
2. **动效 token 整组进 DESIGN.md**:web 与 CMP 两端共用时长/缓动真值。
3. **品牌色是否向 `#1783ff` 靠拢**:影响两端,单独决策,不随本次移动端开发默认执行。
4. **字体重用策略**:MiSans(免费商用)可作 Android 端拉丁字体候选;Geist Mono 已是 OFL 可直接用——均需从官方渠道下载,不搬 APK 内文件。
5. **功能色浅底配方**(色 × 10% alpha)可直接采纳为 tag/徽标规则。

## 9. 边界声明

- 本文档所有数值仅作设计参数参考;APK 内图形、字体、代码资产一律不得复制进仓库。
- 提取行为仅用于学习其设计规范组织方式,最终视觉需经实际渲染验收。

## 附录:复现路径

```sh
scoop install jadx apktool
jadx -d tmp/jadx-kimi -j 8 tmp/kimi_3.1.0.apk   # 433 个方法失败属正常
```

关键文件:
- token 真值:`tmp/jadx-kimi/resources/assets/composeResources/kimi.shared.generated.resources/files/widget_foundation.css`
- 原生佐证:`tmp/jadx-kimi/resources/res/values/colors.xml`、`dimens.xml`
- 字体/动效资产:`tmp/jadx-kimi/resources/assets/composeResources/kimi.shared.generated.resources/{font,files}/`
