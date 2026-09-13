package com.lemmaos.lemma.db

import app.cash.sqldelight.db.SqlDriver

expect fun createDriver(userId: String): SqlDriver
