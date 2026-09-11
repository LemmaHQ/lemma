import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlinJvm)
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_11
    }
}

java {
    sourceCompatibility = JavaVersion.VERSION_11
    targetCompatibility = JavaVersion.VERSION_11
}

sourceSets {
    main {
        java.srcDir("build/generated/source/bufgen")
        kotlin.srcDir("build/generated/source/bufgen")
    }
}

dependencies {
    api(libs.protobuf.javalite)
    api(libs.protobuf.kotlinLite)
    api(libs.connect.kotlin)
    api(libs.connect.kotlinOkhttp)
    api(libs.connect.kotlinJavaliteExt)
}
