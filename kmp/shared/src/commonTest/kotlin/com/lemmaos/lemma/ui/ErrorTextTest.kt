package com.lemmaos.lemma.ui

import com.lemmaos.lemma.data.AppErrorReason
import com.lemmaos.lemma.data.AppException
import kotlin.test.Test
import kotlin.test.assertEquals

class ErrorTextTest {

    @Test
    fun mapsAppErrorReasonToEnglishText() {
        assertEquals(
            "Incorrect username or password.",
            errorText(AppException(AppErrorReason.CREDENTIALS_INVALID, emptyMap(), "raw")),
        )
    }

    @Test
    fun interpolatesBucketNameForBucketNotFound() {
        assertEquals(
            "Bucket archive does not exist. Create it on the backend first.",
            errorText(AppException(AppErrorReason.BUCKET_NOT_FOUND, mapOf("bucket" to "archive"), "raw")),
        )
    }

    @Test
    fun fallsBackToRawMessageWithoutReason() {
        assertEquals(
            "[unavailable] network unreachable",
            errorText(AppException(null, emptyMap(), "[unavailable] network unreachable")),
        )
        assertEquals("boom", errorText(IllegalStateException("boom")))
    }
}
