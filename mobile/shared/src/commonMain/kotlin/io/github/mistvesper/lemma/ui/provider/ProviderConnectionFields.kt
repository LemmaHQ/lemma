package io.github.mistvesper.lemma.ui.provider

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import io.github.mistvesper.lemma.client.ApiFormat
import io.github.mistvesper.lemma.ui.components.LemmaField
import io.github.mistvesper.lemma.ui.components.LemmaPasswordField
import io.github.mistvesper.lemma.ui.components.LemmaTextField
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.provider_api_key
import lemma.mobile.shared.generated.resources.provider_api_key_desc
import lemma.mobile.shared.generated.resources.provider_api_key_placeholder
import lemma.mobile.shared.generated.resources.provider_api_path
import lemma.mobile.shared.generated.resources.provider_api_path_desc
import lemma.mobile.shared.generated.resources.provider_api_path_desc_gemini
import lemma.mobile.shared.generated.resources.provider_base_url
import lemma.mobile.shared.generated.resources.provider_base_url_desc
import lemma.mobile.shared.generated.resources.provider_base_url_invalid
import org.jetbrains.compose.resources.stringResource

/** The API key, base URL, and request path fields of a provider of [apiFormat]. */
@Composable
internal fun ProviderConnectionFields(
    apiFormat: ApiFormat,
    apiKey: String,
    onApiKeyChange: (String) -> Unit,
    baseUrl: String,
    onBaseUrlChange: (String) -> Unit,
    apiPath: String,
    onApiPathChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val placeholders = connectionPlaceholders(apiFormat)
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(20.dp)) {
        LemmaField(
            label = stringResource(Res.string.provider_api_key),
            description = stringResource(Res.string.provider_api_key_desc),
        ) {
            LemmaPasswordField(
                value = apiKey,
                onValueChange = onApiKeyChange,
                placeholder = stringResource(Res.string.provider_api_key_placeholder),
            )
        }
        LemmaField(
            label = stringResource(Res.string.provider_base_url),
            description = stringResource(Res.string.provider_base_url_desc),
            error =
                if (isBaseUrlInvalid(baseUrl)) {
                    stringResource(Res.string.provider_base_url_invalid)
                } else {
                    null
                },
        ) {
            LemmaTextField(
                value = baseUrl,
                onValueChange = onBaseUrlChange,
                placeholder = placeholders.baseUrl,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
            )
        }
        LemmaField(
            label = stringResource(Res.string.provider_api_path),
            description =
                stringResource(
                    if (apiFormat == ApiFormat.Gemini) Res.string.provider_api_path_desc_gemini
                    else Res.string.provider_api_path_desc
                ),
        ) {
            LemmaTextField(
                value = apiPath,
                onValueChange = onApiPathChange,
                placeholder = placeholders.apiPath,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
            )
        }
    }
}
