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
- Protobuf 与 Connect 的 Kotlin 代码通过 `just proto-gen` 生成到 `shared/build/generated/source/bufgen/`。
- Gradle 构建 `crates/shared/lemma-mobile`，把它的 UniFFI Kotlin 绑定生成到 `shared/build/generated/source/uniffi/`，把 JNI 库生成到 `shared/src/androidMain/jniLibs/`；这需要 `cargo-ndk` 与 Android NDK。`lemma-mobile` 的公共 API 变更就是 Kotlin API 变更。
- Gradle 在编译前运行 `design/gen-tokens.mjs`，把 [design/tokens.json](../design/tokens.json) 中的静态色板 `LemmaPalette` 写入 `shared/build/generated/source/tokens/`；这需要 Node。`theme/Scheme.kt` 把色板映射到应用的颜色角色。
- 生成代码不手工修改，也不提交。

## 命令

```sh
just mobile-android-build   # 构建 debug APK
just mobile-android-test    # androidApp 单元测试与 shared 的 host 测试
```
