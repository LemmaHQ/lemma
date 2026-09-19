package dev.lemmahq.lemma.network

import com.connectrpc.ConnectException
import dev.lemmahq.gen.lemma.v1.ErrorInfo

object ErrorFormatter {
    fun format(throwable: Throwable): String {
        return when (throwable) {
            is ConnectException -> {
                val errorInfo = throwable.unpackedDetails(ErrorInfo::class).firstOrNull()
                if (errorInfo != null && errorInfo.reason != dev.lemmahq.gen.lemma.v1.ErrorReason.ERROR_REASON_UNSPECIFIED) {
                    errorInfo.reason.name
                } else if (!throwable.message.isNullOrBlank()) {
                    throwable.message ?: "Connection failed"
                } else {
                    "Request failed (${throwable.code.name})"
                }
            }
            else -> throwable.message ?: "Network error occurred"
        }
    }
}
