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
                maven(
                    "https://github.com/rustls/rustls-platform-verifier/raw/maven-archive/android-release-support/maven/"
                )
            }
            filter { includeGroup("org.rustls") }
        }
    }
}

abstract class RustlsPlatformVerifierVersion :
    ValueSource<String, RustlsPlatformVerifierVersion.Params> {
    interface Params : ValueSourceParameters {
        val lockFile: RegularFileProperty
    }

    override fun obtain(): String {
        val lines = parameters.lockFile.get().asFile.readLines()
        val nameLine = lines.indexOf("name = \"rustls-platform-verifier-android\"")
        check(nameLine >= 0) { "Cargo.lock has no rustls-platform-verifier-android package" }
        return lines[nameLine + 1].removePrefix("version = \"").removeSuffix("\"")
    }
}

gradle.lifecycle.beforeProject {
    val rustlsPlatformVerifierVersion =
        providers.of(RustlsPlatformVerifierVersion::class.java) {
            parameters.lockFile.set(rootDir.resolve("Cargo.lock"))
        }
    configurations.configureEach {
        resolutionStrategy.eachDependency {
            if (requested.group == "org.rustls" && requested.name == "rustls-platform-verifier") {
                useVersion(rustlsPlatformVerifierVersion.get())
                because("the AAR must match rustls-platform-verifier-android in Cargo.lock")
            }
        }
    }
}

include(":mobile:androidApp")

include(":mobile:shared")
