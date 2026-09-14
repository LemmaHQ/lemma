package com.lemmaos.lemma.db

import android.content.Context
import app.cash.sqldelight.db.SqlDriver
import app.cash.sqldelight.driver.android.AndroidSqliteDriver

private lateinit var appContext: Context

fun initDb(context: Context) {
    appContext = context
}

actual fun createDriver(userId: String): SqlDriver {
    val driver = AndroidSqliteDriver(LemmaDb.Schema, appContext, "cache/$userId.db")
    return driver
}
