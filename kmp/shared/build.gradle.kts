import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.androidMultiplatformLibrary)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
    alias(libs.plugins.sqldelightPlugin)
}

kotlin {
    jvm()

    android {
        namespace = "com.lemmaos.lemma.shared"
        compileSdk = libs.versions.android.compileSdk.get().toInt()
        minSdk = libs.versions.android.minSdk.get().toInt()

        compilerOptions {
            jvmTarget = JvmTarget.JVM_11
        }
        androidResources {
            enable = true
        }
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
        named("jvmMain") { kotlin.srcDir("src/rpc/kotlin") }
        named("androidMain") { kotlin.srcDir("src/rpc/kotlin") }

        jvmMain.dependencies {
            implementation(project(":client"))
            implementation(libs.connect.kotlin)
            implementation(libs.connect.kotlinOkhttp)
            implementation(libs.connect.kotlinJavaliteExt)
            implementation(libs.sqldelight.driverJvm)
        }
        androidMain.dependencies {
            implementation(project(":client"))
            implementation(libs.connect.kotlin)
            implementation(libs.connect.kotlinOkhttp)
            implementation(libs.connect.kotlinJavaliteExt)
            implementation(libs.sqldelight.driverAndroid)
            implementation(libs.compose.uiToolingPreview)
            implementation(libs.compose.uiTooling)
        }
        commonMain.dependencies {
            implementation(libs.sqldelight.runtime)
            implementation(libs.sqldelight.coroutines)
            implementation(libs.compose.foundation)
            implementation(compose.material3)
            implementation(compose.materialIconsExtended)
            implementation(libs.compose.ui)
            implementation(libs.compose.components.resources)
            implementation(libs.compose.uiToolingPreview)
            implementation(libs.androidx.lifecycle.viewmodelCompose)
            implementation(libs.androidx.lifecycle.runtimeCompose)
            implementation(libs.navigation.compose)
            implementation(libs.kotlinx.serializationJson)
            implementation(libs.kotlinx.datetime)
            implementation(libs.kotlinx.coroutinesCore)
            implementation(libs.multiplatform.settingsNoArg)
        }
        commonTest.dependencies {
            implementation(libs.kotlin.test)
            implementation(libs.multiplatform.settingsTest)
        }
    }
}

sqldelight {
    databases {
        create("LemmaDb") {
            packageName.set("com.lemmaos.lemma.db")
            dialect(libs.sqldelight.dialect)
        }
    }
}

dependencies {
    androidRuntimeClasspath(libs.compose.uiTooling)
}