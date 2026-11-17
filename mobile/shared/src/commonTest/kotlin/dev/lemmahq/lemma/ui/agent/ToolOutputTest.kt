package dev.lemmahq.lemma.ui.agent

import kotlin.test.Test
import kotlin.test.assertEquals

class ToolOutputTest {

    private fun call(
        name: String,
        output: String,
        arguments: String = "{}",
        isError: Boolean = false,
        running: Boolean = false,
    ) = UiToolCall("c1", name, arguments, running, output, isError)

    private fun output(text: String, via: String? = null) = ToolOutput(StepDetail.Output(text), via)

    @Test
    fun pathsEndInTheirLastNonEmptySegment() {
        assertEquals(
            listOf("main.rs", "bin", "plain", "/"),
            listOf("C:\\work\\project\\main.rs", "/usr/local/bin/", "plain", "/")
                .map(::lastPathSegment),
        )
    }

    @Test
    fun failedAndRunningCallsShowTheirRawOutput() {
        assertEquals(
            output("not found"),
            parseToolOutput(call("read_file", "not found", isError = true), "src/lib.rs"),
        )
        assertEquals(output(""), parseToolOutput(call("read_file", "", running = true), "a.ts"))
    }

    @Test
    fun readFilesShowTheirContentAsCodeInTheLanguageOfTheirExtension() {
        fun read(path: String, content: String) =
            parseToolOutput(call("read_file", content), path).detail

        assertEquals(
            listOf(
                StepDetail.Code("const x = 1;\nconst y = 2;", "ts"),
                StepDetail.Code("fn main() {}", "rust"),
                StepDetail.Code("all:", null),
                StepDetail.Code("123", null),
                StepDetail.Code("[core]", null),
            ),
            listOf(
                read("src/main.ts", "\"const x = 1;\\nconst y = 2;\""),
                read("src/LIB.RS", "fn main() {}"),
                read("Makefile", "all:"),
                read("count.txt", "123"),
                read(".gitconfig", "[core]"),
            ),
        )
    }

    @Test
    fun writtenFilesShowTheContentTheyWroteOrTheRawOutput() {
        assertEquals(
            listOf(
                StepDetail.Code("# Hello", "markdown"),
                StepDetail.Output("""{"success":true}"""),
                StepDetail.Output("ok"),
            ),
            listOf(
                    """{"path":"README.md","content":"# Hello"}""" to """{"success":true}""",
                    """{"path":"a.txt"}""" to """{"success":true}""",
                    "bad-json" to "ok",
                )
                .map { (arguments, out) ->
                    parseToolOutput(call("write_file", out, arguments), "README.md").detail
                },
        )
    }

    @Test
    fun commandsShowTheirStreamsStopReasonOrFailingExitCode() {
        fun bash(out: String) = parseToolOutput(call("bash", out), "ls").detail

        assertEquals(
            listOf("file.txt\nwarn\n[timeout]", "exit 2", "", "", "", "plain text", "out"),
            listOf(
                    """{"exit_code":0,"stdout":"file.txt","stderr":"warn","stopped":"timeout"}""",
                    """{"exit_code":2,"stdout":"","stderr":""}""",
                    """{"exit_code":0}""",
                    """{"exit_code":"2"}""",
                    """{"stopped":""}""",
                    "plain text",
                    """{"stdout":"out","exit_code":1}""",
                )
                .map { (bash(it) as StepDetail.Output).text },
        )
    }

    @Test
    fun webSearchesListTheirHitsWithTheBackendThatAnswered() {
        val results =
            """
            {"provider":"exa","note":"Top hits","results":[
              "skip-non-object", null,
              {"title":"Rust","url":"https://rust-lang.org","snippet":"Systems language"},
              {"url":"https://doc.rust-lang.org","summary":"Docs summary"},
              {"text":"Fallback text"},
              {}
            ]}
            """
                .trimIndent()

        assertEquals(
            ToolOutput(
                StepDetail.Web(
                    "Top hits",
                    listOf(
                        StepDetail.Web.Hit("Rust", "https://rust-lang.org", "Systems language"),
                        StepDetail.Web.Hit(
                            "https://doc.rust-lang.org",
                            "https://doc.rust-lang.org",
                            "Docs summary",
                        ),
                        StepDetail.Web.Hit("", "", "Fallback text"),
                        StepDetail.Web.Hit("", "", ""),
                    ),
                ),
                via = "exa",
            ),
            parseToolOutput(call("web_search", results), "rust"),
        )
        assertEquals(
            ToolOutput(StepDetail.Web(null, emptyList())),
            parseToolOutput(call("web_search", """{"results":[]}"""), "rust"),
        )
        assertEquals(
            output("plain fallback"),
            parseToolOutput(call("web_search", "plain fallback"), "bad"),
        )
        assertEquals(
            output("""{"results":"none"}"""),
            parseToolOutput(call("web_search", """{"results":"none"}"""), "bad"),
        )
    }

    @Test
    fun fetchedPagesShowTheirTitleAndTextWithTheBackendThatAnswered() {
        fun fetch(out: String) = parseToolOutput(call("web_fetch", out), "https://a.com")

        assertEquals(
            listOf(
                output("Title\n\nBody", via = "deepseek"),
                output("Only text"),
                output("Only title"),
                output(""),
                output("{}"),
                output("raw fetch"),
            ),
            listOf(
                    """{"provider":"deepseek","title":"Title","content":"Body"}""",
                    """{"content":"","text":"Only text"}""",
                    """{"title":"Only title"}""",
                    """{"text":""}""",
                    "{}",
                    "raw fetch",
                )
                .map(::fetch),
        )
    }

    @Test
    fun otherToolsShowTheirRawOutput() {
        assertEquals(output("done"), parseToolOutput(call("custom_tool", "done"), ""))
    }
}
