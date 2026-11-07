package dev.lemmahq.lemma.i18n

import java.io.File
import javax.xml.parsers.DocumentBuilderFactory
import kotlin.test.Test
import kotlin.test.assertEquals
import org.w3c.dom.Element

private val FORMAT_ARGUMENT = Regex("""%\d+\$[a-z]""")

class StringResourcesTest {

    @Test
    fun everyEnglishStringHasAChineseCounterpartWithTheSameArguments() {
        assertEquals(formatArguments("values"), formatArguments("values-zh"))
    }
}

private fun formatArguments(directory: String): Map<String, Set<String>> {
    val file = File("src/commonMain/composeResources/$directory/strings.xml")
    val resources =
        DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(file).documentElement
    val children = resources.childNodes
    return (0 until children.length)
        .map { children.item(it) }
        .filterIsInstance<Element>()
        .associate { element ->
            element.getAttribute("name") to
                FORMAT_ARGUMENT.findAll(element.textContent).map { it.value }.toSet()
        }
}
