package io.github.mistvesper.lemma.ui.agent

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlinx.serialization.json.JsonPrimitive

class ToolJsonTest {

    @Test
    fun onlyJsonParsesAndOnlyObjectsParseAsObjects() {
        assertEquals(JsonPrimitive(1), parseJsonOrNull("1"))
        assertEquals(JsonPrimitive("ok"), parseJsonOrNull("\"ok\""))
        assertNull(parseJsonOrNull("invalid"))
        assertEquals(setOf("a"), parseJsonObject("""{"a":1}""")?.keys)
        assertNull(parseJsonObject("[1,2]"))
        assertNull(parseJsonObject(""))
    }

    @Test
    fun stringsAreReadOnlyFromJsonStrings() {
        val fields = checkNotNull(parseJsonObject("""{"s":"ok","e":"","n":42,"o":{},"z":null}"""))

        assertEquals(
            listOf("ok", "", null, null, null, null),
            listOf("s", "e", "n", "o", "z", "missing").map { fields.string(it) },
        )
        assertEquals(
            listOf("ok", null, null),
            listOf("s", "e", "n").map { fields.nonEmptyString(it) },
        )
        assertNull(jsonString(null))
    }
}
