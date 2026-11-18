package io.github.mistvesper.lemma.ui.agent

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.longOrNull

private val EXTENSION_LANGUAGES =
    mapOf(
        "ts" to "ts",
        "tsx" to "tsx",
        "js" to "js",
        "jsx" to "jsx",
        "rs" to "rust",
        "py" to "python",
        "json" to "json",
        "md" to "markdown",
        "css" to "css",
        "html" to "html",
        "yaml" to "yaml",
        "yml" to "yaml",
        "toml" to "toml",
        "sh" to "bash",
        "proto" to "protobuf",
        "kt" to "kotlin",
        "kts" to "kotlin",
        "sql" to "sql",
    )

/** What a tool call's step shows in full, and the web backend [via] that answered it. */
internal data class ToolOutput(val detail: StepDetail, val via: String? = null)

/**
 * The [call]'s output as its step shows it: file content as code, web search hits, web pages and
 * command output as text, and the raw output of a failed, running, or unknown call. [argument] is
 * the call's display argument, whose file extension names the code's language.
 */
internal fun parseToolOutput(call: UiToolCall, argument: String): ToolOutput {
    if (call.isError || call.running) return ToolOutput(StepDetail.Output(call.output))
    return when (call.name) {
        "read_file" ->
            ToolOutput(
                StepDetail.Code(
                    jsonString(parseJsonOrNull(call.output)) ?: call.output,
                    languageFromPath(argument),
                )
            )
        "write_file" ->
            ToolOutput(
                parseJsonObject(call.arguments)?.string("content")?.let {
                    StepDetail.Code(it, languageFromPath(argument))
                } ?: StepDetail.Output(call.output)
            )
        "web_search" -> parseWebSearch(call.output)
        "web_fetch" -> parseWebFetch(call.output)
        "bash" -> ToolOutput(StepDetail.Output(formatBashOutput(call.output)))
        else -> ToolOutput(StepDetail.Output(call.output))
    }
}

/** The last non-empty segment of [path] split at slashes and backslashes; [path] when none is. */
internal fun lastPathSegment(path: String): String =
    path.split('/', '\\').lastOrNull { it.isNotEmpty() } ?: path

private fun parseWebSearch(raw: String): ToolOutput {
    val response = parseJsonObject(raw)
    val results = response?.get("results") as? JsonArray
    if (response == null || results == null) return ToolOutput(StepDetail.Output(raw))
    val hits =
        results.filterIsInstance<JsonObject>().map { entry ->
            val url = entry.string("url").orEmpty()
            StepDetail.Web.Hit(
                title = entry.nonEmptyString("title") ?: url,
                url = url,
                snippet =
                    entry.nonEmptyString("snippet")
                        ?: entry.nonEmptyString("summary")
                        ?: entry.string("text").orEmpty(),
            )
        }
    return ToolOutput(
        StepDetail.Web(response.nonEmptyString("note"), hits),
        response.nonEmptyString("provider"),
    )
}

private fun parseWebFetch(raw: String): ToolOutput {
    val page = parseJsonObject(raw) ?: return ToolOutput(StepDetail.Output(raw))
    val title = page.nonEmptyString("title")
    val body = page.nonEmptyString("content") ?: page.string("text")
    val text = if (title != null && body != null) "$title\n\n$body" else body ?: title ?: raw
    return ToolOutput(StepDetail.Output(text), page.nonEmptyString("provider"))
}

private fun formatBashOutput(raw: String): String {
    val result = parseJsonObject(raw) ?: return raw
    val parts =
        listOfNotNull(
                result.string("stdout"),
                result.string("stderr"),
                result.nonEmptyString("stopped")?.let { "[$it]" },
            )
            .filter { it.isNotEmpty() }
    if (parts.isNotEmpty()) return parts.joinToString("\n")
    val exitCode = (result["exit_code"] as? JsonPrimitive)?.takeUnless { it.isString }?.longOrNull
    return if (exitCode != null && exitCode != 0L) "exit $exitCode" else ""
}

private fun languageFromPath(path: String): String? =
    EXTENSION_LANGUAGES[lastPathSegment(path).substringAfterLast('.', "").lowercase()]
