package dev.lemmahq.lemma.i18n

import dev.lemmahq.lemma.client.ServiceFailure
import kotlin.test.Test
import kotlin.test.assertEquals
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.errors_invalid_branch_point
import lemma.mobile.shared.generated.resources.errors_message_not_found
import lemma.mobile.shared.generated.resources.errors_network
import lemma.mobile.shared.generated.resources.errors_session_busy

class ErrorTextTest {

    @Test
    fun everyServiceFailureMapsToADistinctStringResource() {
        val mapped = ServiceFailure.entries.map(::errorText)

        assertEquals(ServiceFailure.entries.size, mapped.toSet().size)
        assertEquals(
            UiText.Resource(Res.string.errors_message_not_found),
            errorText(ServiceFailure.MessageNotFound),
        )
        assertEquals(
            UiText.Resource(Res.string.errors_invalid_branch_point),
            errorText(ServiceFailure.InvalidBranchPoint),
        )
        assertEquals(
            UiText.Resource(Res.string.errors_session_busy),
            errorText(ServiceFailure.SessionBusy),
        )
        assertEquals(
            UiText.Resource(Res.string.errors_network),
            errorText(ServiceFailure.Network),
        )
    }
}
