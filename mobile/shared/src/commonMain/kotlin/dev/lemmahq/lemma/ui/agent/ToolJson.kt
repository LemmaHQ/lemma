package dev.lemmahq.lemma.ui.agent

import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

private val JSON_LITERAL = Regex("""-?\d+(\.\d+)?([eE][+-]?\d+)?|true|false|null""")

/** [raw] parsed as JSON, or null when `JSON.parse` would reject it, such as a bare word. */
internal fun parseJsonOrNull(raw: String): JsonElement? =
    try {
        Json.parseToJsonElement(raw).takeUnless {
            it is JsonPrimitive && !it.isString && !JSON_LITERAL.matches(it.content)
        }
    } catch (_: SerializationException) {
        null
    }

/** [raw] parsed as a JSON object, or null when it holds anything else. */
internal fun parseJsonObject(raw: String): JsonObject? = parseJsonOrNull(raw) as? JsonObject

/** The JSON string [element] holds, or null when it holds anything else. */
internal fun jsonString(element: JsonElement?): String? =
    (element as? JsonPrimitive)?.takeIf { it.isString }?.content

/** The string at [key], or null when it is absent or not a string. */
internal fun JsonObject.string(key: String): String? = jsonString(get(key))

/** The string at [key], or null when it is absent, not a string, or empty. */
internal fun JsonObject.nonEmptyString(key: String): String? =
    string(key)?.takeIf { it.isNotEmpty() }
