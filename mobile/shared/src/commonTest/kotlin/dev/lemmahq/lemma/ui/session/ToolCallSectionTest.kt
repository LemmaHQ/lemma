package dev.lemmahq.lemma.ui.session

import kotlin.test.Test
import kotlin.test.assertEquals

class ToolCallSectionTest {

    @Test
    fun jsonObjectsAndArraysAreIndentedAndOtherTextIsKept() {
        assertEquals(
            "{\n  \"cmd\": \"date\",\n  \"args\": [\n    1\n  ]\n}",
            indentJson(""" {"cmd":"date","args":[1]} """),
        )
        assertEquals("[\n  1,\n  2\n]", indentJson("[1,2]"))
        assertEquals("{not json", indentJson("{not json"))
        assertEquals("Fri 12:00", indentJson("Fri 12:00"))
    }
}
