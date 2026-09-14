import org.jetbrains.compose.desktop.application.dsl.TargetFormat

plugins {
    alias(libs.plugins.kotlinJvm)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
}

dependencies {
    implementation(project(":shared"))

    implementation(compose.desktop.currentOs)
    implementation(libs.kotlinx.coroutinesSwing)

    implementation(libs.compose.uiToolingPreview)
}

compose.desktop {
    application {
        mainClass = "com.lemmaos.lemma.MainKt"

        // Skiko loads its native library through System::load; opting in keeps the
        // JDK 24+ restricted-method warning off the console.
        jvmArgs += listOf("--enable-native-access=ALL-UNNAMED")

        nativeDistributions {
            targetFormats(TargetFormat.Dmg, TargetFormat.Msi, TargetFormat.Deb)
            packageName = "Lemma"
            packageVersion = "1.0.0"
            description = "Self-hosted AI chat client"
            vendor = "LemmaOS"

            // jlink prunes the runtime image to detected modules; the SQLDelight JDBC
            // driver resolves java.sql reflectively, so it must be requested explicitly.
            modules("java.sql")

            windows {
                menuGroup = "Lemma"
                // Stable across releases so installers upgrade in place instead of
                // stacking side-by-side entries.
                upgradeUuid = "6F2B9C4E-8D3A-4E17-9B25-1C0A7E5D4F83"
                dirChooser = true
                perUserInstall = true
                shortcut = true
            }

            macOS {
                bundleID = "com.lemmaos.lemma"
            }

            linux {
                packageName = "lemma"
                debMaintainer = "dev@lemmaos.com"
                appCategory = "Network"
            }
        }
    }
}
