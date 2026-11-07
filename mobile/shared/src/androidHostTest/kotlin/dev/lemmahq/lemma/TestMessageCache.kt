package dev.lemmahq.lemma

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import dev.lemmahq.lemma.data.LocalMessageRepository
import dev.lemmahq.lemma.db.LemmaDatabase
import kotlinx.coroutines.CoroutineDispatcher

internal actual fun testMessageCache(dispatcher: CoroutineDispatcher): LocalMessageRepository {
    val driver = JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY)
    LemmaDatabase.Schema.create(driver)
    return LocalMessageRepository(LemmaDatabase(driver), dispatcher)
}
