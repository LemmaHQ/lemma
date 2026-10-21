import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.androidMultiplatformLibrary)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
    alias(libs.plugins.sqldelight)
    alias(libs.plugins.kover)
}

val designTokensDir = layout.buildDirectory.dir("generated/source/tokens")

val generateDesignTokens =
    tasks.register<Exec>("generateDesignTokens") {
        workingDir = rootProject.projectDir
        commandLine("node", "design/gen-tokens.ts")
        inputs.file(rootProject.file("design/tokens.json"))
        inputs.file(rootProject.file("design/gen-tokens.ts"))
        outputs.dir(designTokensDir)
    }

val hostOs = org.gradle.internal.os.OperatingSystem.current()
val hostArch =
    if (System.getProperty("os.arch") in setOf("aarch64", "arm64")) "aarch_64" else "x86_64"
val protocClassifier =
    when {
        hostOs.isWindows -> "windows-x86_64"
        hostOs.isMacOsX -> "osx-$hostArch"
        else -> "linux-$hostArch"
    }

val protoGenerators by configurations.creating { isTransitive = false }
val protoGeneratorsDir = layout.buildDirectory.dir("proto-generators")

dependencies {
    protoGenerators(
        variantOf(libs.protoc) {
            classifier(protocClassifier)
            artifactType("exe")
        }
    )
    protoGenerators(libs.connect.kotlin.protocGen)
}

val installProtoGenerators =
    tasks.register<Sync>("installProtoGenerators") {
        val protocName = if (hostOs.isWindows) "protoc.exe" else "protoc"
        from(protoGenerators)
        into(protoGeneratorsDir)
        rename { name ->
            if (name.endsWith(".jar")) "protoc-gen-connect-kotlin.jar" else protocName
        }
        filePermissions { user { execute = true } }
    }

abstract class BufGenerate : Exec() {
    @get:OutputDirectory abstract val outputDir: DirectoryProperty
}

val generateProtoBindings =
    tasks.register<BufGenerate>("generateProtoBindings") {
        workingDir = rootProject.file("proto")
        val javaBin = File(System.getProperty("java.home"), "bin")
        val path = listOf(protoGeneratorsDir.get().asFile, javaBin, System.getenv("PATH"))
        environment("PATH", path.joinToString(File.pathSeparator))
        commandLine("buf", "generate", "--template", "buf.gen.mobile.yaml")
        inputs.files(installProtoGenerators)
        inputs.dir(rootProject.file("proto/lemma"))
        inputs.file(rootProject.file("proto/buf.gen.mobile.yaml"))
        outputDir.set(layout.buildDirectory.dir("generated/source/bufgen"))
    }

kotlin {
    android {
        namespace = "dev.lemmahq.lemma.shared"
        compileSdk = libs.versions.android.compileSdk.get().toInt()
        minSdk = libs.versions.android.minSdk.get().toInt()

        compilerOptions {
            jvmTarget = JvmTarget.JVM_11
        }
        androidResources {
            enable = true
        }
        withJava()
        withHostTest {
            isIncludeAndroidResources = true
        }
        withDeviceTestBuilder {
            sourceSetTreeName = "test"
        }
            .configure {
                instrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
            }
    }

    sourceSets {
        androidMain {
            kotlin.srcDir("build/generated/source/uniffi")
            dependencies {
                implementation(libs.compose.uiToolingPreview)
                implementation(libs.compose.uiTooling)
                implementation(libs.sqldelight.android.driver)
                implementation(libs.kotlinx.coroutines.android)
                implementation("net.java.dev.jna:jna:5.19.1@aar")
            }
        }
        commonMain {
            kotlin.srcDir(generateProtoBindings)
            kotlin.srcDir(generateDesignTokens)
            dependencies {
                implementation(libs.compose.runtime)
                implementation(libs.compose.foundation)
                implementation(libs.compose.material3)
                implementation(libs.compose.ui)
                implementation(libs.compose.components.resources)
                implementation(libs.compose.uiToolingPreview)
                implementation(libs.multiplatform.settings)
                implementation(libs.multiplatform.settings.no.arg)
                implementation(libs.connect.kotlin)
                implementation(libs.connect.kotlin.okhttp)
                implementation(libs.connect.kotlin.javalite.ext)
                implementation(libs.okhttp)
                implementation(libs.protobuf.javalite)
                implementation(libs.protobuf.kotlin.lite)
                implementation(libs.markdown.renderer)
                implementation(libs.markdown.renderer.m3)
            }
        }
        commonTest.dependencies {
            implementation(libs.kotlin.test)
            implementation(libs.multiplatform.settings.test)
            implementation(libs.sqldelight.sqlite.driver)
        }
    }
}

sqldelight {
    databases {
        create("LemmaDatabase") {
            packageName.set("dev.lemmahq.lemma.db")
            schemaOutputDirectory.set(file("src/commonMain/sqldelight/databases"))
            verifyMigrations.set(true)
        }
    }
}

dependencies {
    androidRuntimeClasspath(libs.compose.uiTooling)
}

androidComponents {
    onVariants {
        it.sources.java?.addGeneratedSourceDirectory(generateProtoBindings, BufGenerate::outputDir)
    }
}

val lemmaRustProfile = providers.gradleProperty("lemma.rust.profile").orElse("debug").get()
val lemmaHostLibPath =
    "target/debug/" +
        when {
            org.gradle.internal.os.OperatingSystem.current().isWindows -> "lemma_mobile.dll"
            org.gradle.internal.os.OperatingSystem.current().isMacOsX -> "liblemma_mobile.dylib"
            else -> "liblemma_mobile.so"
        }
val androidSdkDir =
    System.getenv("ANDROID_HOME")
        ?: rootProject
            .file("local.properties")
            .takeIf { it.isFile }
            ?.let { localProps ->
                val props = Properties()
                localProps.inputStream().use { stream -> props.load(stream) }
                props.getProperty("sdk.dir")
            }
val androidNdkDir = androidSdkDir?.let { sdk ->
    file("${sdk}/ndk").listFiles()?.filter { it.isDirectory }?.maxByOrNull { it.name }
}

val uniffiGeneratedDir = layout.buildDirectory.dir("generated/source/uniffi")
val lemmaJniLibsDir = layout.projectDirectory.dir("src/androidMain/jniLibs")

val buildLemmaMobileHost =
    tasks.register<Exec>("buildLemmaMobileHost") {
        workingDir = rootProject.projectDir
        commandLine("cargo", "build", "-p", "lemma-mobile")
        inputs.dir(rootProject.file("crates/shared/lemma-mobile/src"))
        inputs.file(rootProject.file("crates/shared/lemma-mobile/Cargo.toml"))
        inputs.file(rootProject.file("Cargo.lock"))
        outputs.file(rootProject.file(lemmaHostLibPath))
    }

val generateUniffiBindings =
    tasks.register<Exec>("generateUniffiBindings") {
        dependsOn(buildLemmaMobileHost)
        workingDir = rootProject.projectDir
        commandLine(
            "cargo",
            "run",
            "-p",
            "lemma-mobile",
            "--features",
            "bindgen",
            "--bin",
            "uniffi-bindgen",
            "--",
            "generate",
            "--library",
            lemmaHostLibPath,
            "--language",
            "kotlin",
            "--no-format",
            "--config",
            "crates/shared/lemma-mobile/uniffi.toml",
            "--out-dir",
            uniffiGeneratedDir.get().asFile.absolutePath,
        )
        inputs.file(rootProject.file("crates/shared/lemma-mobile/uniffi.toml"))
        inputs.file(rootProject.file(lemmaHostLibPath))
        outputs.dir(uniffiGeneratedDir)
    }

val buildLemmaMobileJniLibs =
    tasks.register<Exec>("buildLemmaMobileJniLibs") {
        workingDir = rootProject.projectDir
        androidNdkDir?.let { environment("ANDROID_NDK_HOME", it.absolutePath) }
        commandLine(
            mutableListOf("cargo", "ndk", "-o", lemmaJniLibsDir.asFile.absolutePath).apply {
                listOf("arm64-v8a", "armeabi-v7a", "x86", "x86_64").forEach { abi ->
                    add("-t")
                    add(abi)
                }
                add("build")
                add("-p")
                add("lemma-mobile")
                if (lemmaRustProfile == "release") {
                    add("--release")
                }
            }
        )
        inputs.dir(rootProject.file("crates/shared/lemma-mobile/src"))
        inputs.file(rootProject.file("crates/shared/lemma-mobile/Cargo.toml"))
        inputs.file(rootProject.file("Cargo.lock"))
        outputs.dir(lemmaJniLibsDir)
    }

tasks.configureEach {
    if (name.startsWith("compileAndroid")) {
        dependsOn(generateUniffiBindings)
    }
    if (name.startsWith("merge") && name.endsWith("JniLibFolders")) {
        dependsOn(buildLemmaMobileJniLibs)
    }
}
