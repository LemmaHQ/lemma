rootProject.name = "Lemma"

pluginManagement {
    repositories {
        google {
            mavenContent {
                includeGroupAndSubgroups("androidx")
                includeGroupAndSubgroups("com.android")
                includeGroupAndSubgroups("com.google")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

dependencyResolutionManagement {
    repositories {
        google {
            mavenContent {
                includeGroupAndSubgroups("androidx")
                includeGroupAndSubgroups("com.android")
                includeGroupAndSubgroups("com.google")
            }
        }
        mavenCentral()
        exclusiveContent {
            forRepository {
                maven(rustlsPlatformVerifierRepository()) {
                    metadataSources {
                        mavenPom()
                        artifact()
                    }
                }
            }
            filter { includeGroup("rustls") }
        }
    }
}

fun rustlsPlatformVerifierRepository(): File {
    val metadata =
        providers
            .exec {
                workingDir = settingsDir
                commandLine(
                    "cargo",
                    "metadata",
                    "--format-version",
                    "1",
                    "--filter-platform",
                    "aarch64-linux-android",
                    "--manifest-path",
                    "crates/mobile/lemma-mobile/Cargo.toml",
                )
            }
            .standardOutput
            .asText
            .get()
    val packages = (groovy.json.JsonSlurper().parseText(metadata) as Map<*, *>)["packages"]
    val manifest =
        (packages as List<*>)
            .map { it as Map<*, *> }
            .first { it["name"] == "rustls-platform-verifier-android" }["manifest_path"]
    return File(manifest as String).resolveSibling("maven")
}

include(":mobile:androidApp")

include(":mobile:shared")
