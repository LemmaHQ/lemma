package com.lemmaos.lemma.db

import app.cash.sqldelight.db.SqlDriver
import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import java.io.File

actual fun createDriver(userId: String): SqlDriver {
    val home = System.getProperty("user.home")
    val dir = File(home, ".lemma/cache")
    dir.mkdirs()
    val dbFile = File(dir, "$userId.db")
    val driver = JdbcSqliteDriver("jdbc:sqlite:${dbFile.absolutePath}")
    LemmaDb.Schema.create(driver)
    return driver
}
