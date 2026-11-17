# AGENTS.md — Android 客户端

[English](AGENTS.md) | 中文

这些规则是对仓库级[约定](../AGENTS.zh.md#约定)的补充。

## Kotlin

- **语句末尾省略分号。** 单表达式函数使用 `= expr`，省略返回类型。
- **大括号遵循 K&R 风格：** 左括号置于行末。
- **可空值用 `?.`、`?:` 与 `let` 处理。**
- **属性使用 `camelCase`；** 唯一例外是与公开 `prop` 配对的私有 backing property `_prop`。
- **包名一律全小写，单词直接连写；** 每个文件一条 `package` 语句。
- **KDoc** 是公共 API 上的紧凑契约，首句是完整的摘要短语；自解释的属性与方法省略 KDoc。

## 目录结构

`:mobile:shared` 的代码位于 `dev.lemmahq.lemma` 下，按职责分包：

- 根包存放承载导航的 `App` 及其 `AppViewModel`。
- `client/` 存放 `LemmaClient` 与 `Connector` 接口及其类型；`network/` 基于 Connect 实现它们；`data/` 存放 `SettingsRepository` 以及偏好与模型选择类型。
- `ui/<功能>/` 存放每个功能的 ViewModel、界面及其私有 Composable，与 web 端同名功能对应：`ui/agent/` 是打开的会话（`AgentViewModel`、`SessionStage`、消息、输入框、模型选择器、完整显示回复中代码块的代码面板，以及切换分支、回退到提问并给消息加标签的会话树面板），`ui/session/` 是会话列表（`SessionListViewModel`、抽屉，以及承载会话舞台的 `SessionScreen` 外壳），`ui/provider/` 是 AI 服务商，`ui/webprovider/` 是网络服务商，`ui/preferences/` 是外观，`ui/settings/` 是设置菜单。功能之间互不导入，唯一例外是 `ui/session/` 驱动 `ui/agent/`：其外壳承载会话舞台，其列表在那里打开与关闭会话、显示自身的失败，并根据 agent 的 `turns` 标记运行中、已完成与出错的回合。Android 会话列表按时间分组，因为 Android 会话没有会话目录；web 端则按目录分组。
- `ui/components/` 存放共用的 `Lemma*` 组件和多个功能共用的部件（`SaveBar`、`ProviderEnabledRow`、`ProviderErrorText`、`runOptimistic`）；`theme/` 存放 `LemmaTheme`，由它提供生成的颜色、字体与形状。
- `i18n/` 存放 `UiText` 与 `errorText`；面向用户的文本来自 [i18n/](../i18n/README.zh.md) 的平台中立源文件，由生成器写入被 Git 忽略的 `composeResources/values/strings.xml` 与 `values-zh/strings.xml`。
- `commonMain` 不使用仅限 JVM 的库：Connect、OkHttp 与引擎放在 `androidMain` 下对应的包或 `engine/` 中。

## 模块与生成代码

- `:mobile:androidApp` 是 Android 应用；`:mobile:shared` 是 Kotlin Multiplatform 模块，包含 UI 与两套生成的绑定代码。
- Gradle 在编译 Kotlin 之前把 Protobuf 与 Connect 的 Kotlin 代码生成到 `shared/build/generated/source/bufgen/`：它运行 `buf`，所用的 `protoc` 与 `protoc-gen-connect-kotlin` 来自 Maven，版本与运行时库相同；这需要 `buf` 与 Java（[proto/AGENTS.zh.md](../proto/AGENTS.zh.md)）。
- Gradle 在编译 Kotlin 之前为宿主机构建 `crates/mobile/lemma-mobile`，并把它的 UniFFI Kotlin 绑定生成到 `shared/build/generated/source/uniffi/`。打包 APK 时还会把它的 JNI 库交叉编译到 `shared/src/androidMain/jniLibs/`，这需要 `cargo-ndk` 与 Android NDK。`lemma-mobile` 的公共 API 变更就是 Kotlin API 变更。
- `engine/LocalEngine.kt` 在应用的数据目录（`filesDir`）上打开 `LemmaEngine`，通过它的 `request`、`read` 与 `cancel` 响应 OkHttp 请求；`network/AndroidConnector.kt` 打开它一次并返回 `ConnectLemmaClient`。
- Gradle 在编译前运行 `scripts/design-token/gen-tokens.ts`，把 `LemmaTokens.kt` 写入 `shared/build/generated/source/tokens/`：其中是来自 [design/tokens.json](../design/README.zh.md) 的亮色与暗色 `LemmaColorScheme`、`LemmaTypography` 与 `LemmaShapes`，颜色角色、字体样式与圆角都与 Web 主题相同；这需要 Node。`theme/Theme.kt` 通过 `LemmaTheme` 提供它们。
- Gradle 的 `generateStrings` 任务在组装 Compose 资源前运行 `scripts/i18n/gen-i18n.ts`，从 [i18n/](../i18n/README.zh.md) 的源文件生成字符串资源；这需要 Node。Kotlin 通过生成的 `Res.string` 与 `Res.plurals` 访问器读取这些资源。
- 生成代码不手工修改，也不提交。

## 命令

```sh
just mobile-android-build       # 构建 debug APK
just mobile-android-test        # androidApp 单元测试与 shared 的 host 测试
just mobile-android-lint-check  # 对 androidApp 与 shared 运行 Android Lint，再按 detekt.yml 运行 Detekt；mobile-android-lint 应用 Lint 修复
just mobile-android-cov         # androidApp 与 shared 的 Kover 报告；存在未覆盖的行、未调用的方法或 Composable 函数之外未走到的分支时失败
just mobile-fmt-check           # 经 Spotless 运行 kotlinlang 风格的 ktfmt；mobile-fmt 格式化
```
