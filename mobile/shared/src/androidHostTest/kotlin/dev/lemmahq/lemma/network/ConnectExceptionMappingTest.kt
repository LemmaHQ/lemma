package dev.lemmahq.lemma.network

import com.connectrpc.Code
import com.connectrpc.ConnectErrorDetail
import com.connectrpc.ConnectException
import com.connectrpc.extensions.GoogleJavaLiteProtobufStrategy
import dev.lemmahq.gen.lemma.v1.ErrorInfo
import dev.lemmahq.gen.lemma.v1.ErrorReason
import dev.lemmahq.gen.lemma.v1.errorInfo
import dev.lemmahq.lemma.client.ServiceFailure
import java.io.IOException
import kotlin.test.Test
import kotlin.test.assertEquals
import okio.ByteString.Companion.toByteString

class ConnectExceptionMappingTest {

    @Test
    fun everyErrorReasonFailsWithTheFailureOfItsName() {
        val reasons = ErrorReason.entries - ErrorReason.UNRECOGNIZED

        assertEquals(
            reasons.map { it.name.removePrefix("ERROR_REASON_").pascalCase() },
            reasons.map { failure(Code.UNKNOWN, errorInfo { reason = it }).name },
        )
    }

    @Test
    fun theCodeDecidesTheFailureWithoutAReason() {
        val codes =
            listOf(
                Code.UNAVAILABLE,
                Code.DEADLINE_EXCEEDED,
                Code.UNAUTHENTICATED,
                Code.INTERNAL_ERROR,
            )

        assertEquals(
            listOf(
                ServiceFailure.Network,
                ServiceFailure.Timeout,
                ServiceFailure.TokenInvalid,
                ServiceFailure.Unspecified,
            ),
            codes.map { failure(it, info = null) },
        )
    }

    @Test
    fun anUnknownFailureIsANetworkFailureOnlyForAnIoException() {
        val offline = ConnectException(Code.UNKNOWN, "offline", IOException("offline"))
        val broken = ConnectException(Code.UNKNOWN, "broken", IllegalStateException("broken"))

        assertEquals(ServiceFailure.Network, offline.toServiceException().failure)
        assertEquals(ServiceFailure.Unspecified, broken.toServiceException().failure)
    }

    @Test
    fun anUnknownReasonFallsBackToTheCode() {
        val info = errorInfo { reasonValue = 999 }

        assertEquals(ServiceFailure.Network, failure(Code.UNAVAILABLE, info))
    }
}

private fun failure(code: Code, info: ErrorInfo?): ServiceFailure {
    val details =
        listOfNotNull(info).map {
            ConnectErrorDetail("lemma.v1.ErrorInfo", it.toByteArray().toByteString())
        }
    return ConnectException(code, "failed")
        .withErrorDetails(GoogleJavaLiteProtobufStrategy().errorDetailParser(), details)
        .toServiceException()
        .failure
}

private fun String.pascalCase(): String =
    lowercase().split('_').joinToString("") { it.replaceFirstChar(Char::uppercase) }
