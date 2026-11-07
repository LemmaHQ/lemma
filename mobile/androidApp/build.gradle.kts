import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.androidApplication)
    alias(libs.plugins.composeCompiler)
    alias(libs.plugins.kover)
    alias(libs.plugins.detekt)
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_11
        allWarningsAsErrors = true
    }
}

dependencies {
    implementation(project(":mobile:shared"))
    kover(project(":mobile:shared"))

    implementation(libs.androidx.activity.compose)
    implementation(libs.multiplatform.settings)

    testImplementation(libs.robolectric)
    testImplementation(libs.compose.uiTestJunit4)
    testImplementation(libs.androidx.test.espresso.core)

    detektPlugins(libs.compose.rules.detekt)
}

detekt {
    buildUponDefaultConfig = true
    config.setFrom(rootProject.file("mobile/detekt.yml"))
}

kover {
    reports {
        filters {
            excludes {
                packages(
                    "dev.lemmahq.gen",
                    "dev.lemmahq.lemma.db",
                    "dev.lemmahq.lemma.uniffi",
                    "lemma.mobile.shared.generated.resources",
                )
                classes("dev.lemmahq.lemma.theme.LemmaPalette")
            }
        }
    }
}

tasks.withType<Test>().configureEach {
    jvmArgs("--add-opens=java.base/jdk.internal.access=ALL-UNNAMED")
}

android {
    namespace = "dev.lemmahq.lemma"
    compileSdk = libs.versions.android.compileSdk.get().toInt()

    defaultConfig {
        applicationId = "dev.lemmahq.lemma"
        minSdk = libs.versions.android.minSdk.get().toInt()
        targetSdk = libs.versions.android.targetSdk.get().toInt()
        versionCode = 1
        versionName = "1.0"
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        buildConfig = true
        compose = true
    }
    testOptions {
        unitTests {
            isIncludeAndroidResources = true
        }
    }
    lint {
        warningsAsErrors = true
        checkDependencies = true
    }
}
