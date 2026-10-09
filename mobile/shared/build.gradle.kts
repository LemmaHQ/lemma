import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.androidMultiplatformLibrary)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
    alias(libs.plugins.sqldelight)
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
       }.configure {
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
                implementation("net.java.dev.jna:jna:5.17.0@aar")
            }
        }
        commonMain {
            kotlin.srcDir("build/generated/source/bufgen")
            dependencies {
                implementation(libs.compose.runtime)
                implementation(libs.compose.foundation)
                implementation(libs.compose.material3)
                implementation(libs.compose.ui)
                implementation(libs.compose.components.resources)
                implementation(libs.compose.uiToolingPreview)
                implementation(libs.androidx.lifecycle.viewmodelCompose)
                implementation(libs.androidx.lifecycle.runtimeCompose)
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
                implementation(libs.sqldelight.coroutines)
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
        }
    }
}

dependencies {
    androidRuntimeClasspath(libs.compose.uiTooling)
}

androidComponents {
    onVariants {
        it.sources.java?.addStaticSourceDirectory("build/generated/source/bufgen")
    }
}

val lemmaRustProfile = providers.gradleProperty("lemma.rust.profile").orElse("debug").get()
val lemmaHostLibExtension = when {
    org.gradle.internal.os.OperatingSystem.current().isWindows -> "dll"
    org.gradle.internal.os.OperatingSystem.current().isMacOsX -> "dylib"
    else -> "so"
}
val androidSdkDir = System.getenv("ANDROID_HOME")
    ?: rootProject.file("local.properties").takeIf { it.isFile }?.let { localProps ->
        val props = Properties()
        localProps.inputStream().use { stream -> props.load(stream) }
        props.getProperty("sdk.dir")
    }
val androidNdkDir = androidSdkDir?.let { sdk ->
    file("${sdk}/ndk").listFiles()?.filter { it.isDirectory }?.maxByOrNull { it.name }
}

val uniffiGeneratedDir = layout.buildDirectory.dir("generated/source/uniffi")
val lemmaJniLibsDir = layout.projectDirectory.dir("src/androidMain/jniLibs")

val buildLemmaMobileHost = tasks.register<Exec>("buildLemmaMobileHost") {
    workingDir = rootProject.projectDir
    commandLine("cargo", "build", "-p", "lemma-mobile")
    inputs.dir(rootProject.file("crates/shared/lemma-mobile/src"))
    inputs.file(rootProject.file("crates/shared/lemma-mobile/Cargo.toml"))
    outputs.file(rootProject.file("target/debug/lemma_mobile.${lemmaHostLibExtension}"))
}

val generateUniffiBindings = tasks.register<Exec>("generateUniffiBindings") {
    dependsOn(buildLemmaMobileHost)
    workingDir = rootProject.projectDir
    commandLine(
        "cargo", "run", "-p", "lemma-mobile", "--features", "bindgen", "--bin", "uniffi-bindgen", "--",
        "generate",
        "--library", "target/debug/lemma_mobile.${lemmaHostLibExtension}",
        "--language", "kotlin",
        "--no-format",
        "--config", "crates/shared/lemma-mobile/uniffi.toml",
        "--out-dir", uniffiGeneratedDir.get().asFile.absolutePath,
    )
    inputs.file(rootProject.file("crates/shared/lemma-mobile/uniffi.toml"))
    outputs.dir(uniffiGeneratedDir)
}

val buildLemmaMobileJniLibs = tasks.register<Exec>("buildLemmaMobileJniLibs") {
    workingDir = rootProject.projectDir
    androidNdkDir?.let { environment("ANDROID_NDK_HOME", it.absolutePath) }
    commandLine(mutableListOf("cargo", "ndk", "-o", lemmaJniLibsDir.asFile.absolutePath).apply {
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
    })
    inputs.dir(rootProject.file("crates/shared/lemma-mobile/src"))
    outputs.dir(lemmaJniLibsDir)
}

tasks.configureEach {
    if (name.startsWith("compileAndroid")) {
        dependsOn(generateUniffiBindings, buildLemmaMobileJniLibs)
    }
    if (name.startsWith("merge") && name.endsWith("JniLibFolders")) {
        dependsOn(buildLemmaMobileJniLibs)
    }
}
