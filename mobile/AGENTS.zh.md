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

## 模块与生成代码

- `:mobile:androidApp` 是 Android 应用；`:mobile:shared` 是 Kotlin Multiplatform 模块，包含 UI、SQLDelight 数据库与两套生成的绑定代码。
- Gradle 在编译 Kotlin 之前把 Protobuf 与 Connect 的 Kotlin 代码生成到 `shared/build/generated/source/bufgen/`：它运行 `buf`，所用的 `protoc` 与 `protoc-gen-connect-kotlin` 来自 Maven，版本与运行时库相同；这需要 `buf` 与 Java（[proto/AGENTS.zh.md](../proto/AGENTS.zh.md)）。
- Gradle 在编译 Kotlin 之前为宿主机构建 `crates/shared/lemma-mobile`，并把它的 UniFFI Kotlin 绑定生成到 `shared/build/generated/source/uniffi/`。打包 APK 时还会把它的 JNI 库交叉编译到 `shared/src/androidMain/jniLibs/`，这需要 `cargo-ndk` 与 Android NDK。`lemma-mobile` 的公共 API 变更就是 Kotlin API 变更。
- Gradle 在编译前运行 `design/gen-tokens.ts`，把 [design/tokens.json](../design/tokens.json) 中的静态色板 `LemmaPalette` 写入 `shared/build/generated/source/tokens/`；这需要 Node。`theme/Scheme.kt` 把色板映射到应用的颜色角色。
- 修改 `LemmaDatabase.sq` 的表结构时，要新增下一个 `<N>.sqm` 迁移。修改前先运行 `./gradlew :mobile:shared:generateCommonMainLemmaDatabaseSchema`，把当前结构快照为 `shared/src/commonMain/sqldelight/databases/<N>.db`，并提交这个快照。`verifySqlDelightMigration` 对每个快照执行迁移，结果与 `LemmaDatabase.sq` 不一致时失败。
- 生成代码不手工修改，也不提交。

## 命令

```sh
just mobile-android-build       # 构建 debug APK
just mobile-android-test        # androidApp 单元测试、shared 的 host 测试与 SQLDelight 迁移校验
just mobile-android-lint-check  # 对 androidApp 运行 Android Lint；mobile-android-lint 应用修复
just mobile-android-cov         # androidApp 与 shared 的 Kover HTML 报告
just mobile-fmt-check           # 经 Spotless 运行 kotlinlang 风格的 ktfmt；mobile-fmt 格式化
```
