package io.github.mistvesper.lemma.ui.agent

/** The full content a timeline step shows when it is inspected. */
internal sealed interface StepDetail {

    /** Reasoning [text] in Markdown. */
    data class Prose(val text: String) : StepDetail

    /** File content [code], highlighted as [language] when it is known. */
    data class Code(val code: String, val language: String?) : StepDetail

    /** A web search's [hits] under the backend's [note]. */
    data class Web(val note: String?, val hits: List<Hit>) : StepDetail {

        /** One search result. */
        data class Hit(val title: String, val url: String, val snippet: String)
    }

    /** Command or tool output [text], shown monospaced. */
    data class Output(val text: String) : StepDetail
}
