import javax.xml.parsers.DocumentBuilderFactory
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.w3c.dom.Element

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
                classes("dev.lemmahq.lemma.BuildConfig", "dev.lemmahq.lemma.theme.LemmaPalette")
                annotatedBy("kotlinx.serialization.Serializable")
            }
        }
    }
}

tasks.withType<Test>().configureEach {
    jvmArgs("--add-opens=java.base/jdk.internal.access=ALL-UNNAMED")
}

tasks.register("verifyCoverage") {
    group = "verification"
    description =
        "Fails unless the Kover XML report covers every line, calls every method, and takes every " +
            "branch outside Composable functions."
    dependsOn("koverXmlReport")
    val report = layout.buildDirectory.file("reports/kover/report.xml")
    inputs.file(report)
    doLast {
        fun Element.children(tag: String): List<Element> =
            getElementsByTagName(tag).let { nodes ->
                (0 until nodes.length).map { nodes.item(it) as Element }
            }
        fun Element.count(type: String, attribute: String): Int =
            children("counter")
                .firstOrNull { it.getAttribute("type") == type }
                ?.getAttribute(attribute)
                ?.toInt() ?: 0

        val gaps = mutableListOf<String>()
        val root =
            DocumentBuilderFactory.newInstance()
                .apply {
                    setFeature(
                        "http://apache.org/xml/features/nonvalidating/load-external-dtd",
                        false,
                    )
                }
                .newDocumentBuilder()
                .parse(report.get().asFile)
                .documentElement
        for (pkg in root.children("package")) {
            for (cls in pkg.children("class")) {
                val name = cls.getAttribute("name").replace('/', '.')
                for (method in cls.children("method")) {
                    val where = "$name.${method.getAttribute("name")}"
                    val missedBranches = method.count("BRANCH", "missed")
                    val composable =
                        "Landroidx/compose/runtime/Composer;" in method.getAttribute("desc")
                    if (method.count("INSTRUCTION", "covered") == 0) {
                        gaps += "$where is never called"
                    } else if (missedBranches > 0 && !composable) {
                        gaps += "$where misses $missedBranches branches"
                    }
                }
            }
            for (file in pkg.children("sourcefile")) {
                val missedLines =
                    file
                        .children("line")
                        .filter { it.getAttribute("ci") == "0" && it.getAttribute("mi") != "0" }
                        .map { it.getAttribute("nr") }
                if (missedLines.isNotEmpty()) {
                    val path = "${pkg.getAttribute("name")}/${file.getAttribute("name")}"
                    gaps += "$path misses lines ${missedLines.joinToString()}"
                }
            }
        }
        if (gaps.isNotEmpty()) {
            throw GradleException(gaps.joinToString("\n", prefix = "Coverage gaps:\n"))
        }
    }
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
