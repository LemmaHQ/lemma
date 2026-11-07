package dev.lemmahq.lemma.data

import android.content.Context
import app.cash.sqldelight.db.SqlDriver
import app.cash.sqldelight.driver.android.AndroidSqliteDriver
import dev.lemmahq.lemma.db.LemmaDatabase

class DriverFactory(private val context: Context) {
    fun createDriver(): SqlDriver = AndroidSqliteDriver(LemmaDatabase.Schema, context, "lemma.db")
}
