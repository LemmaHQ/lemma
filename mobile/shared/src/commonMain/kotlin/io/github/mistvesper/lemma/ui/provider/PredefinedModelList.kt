package io.github.mistvesper.lemma.ui.provider

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import io.github.mistvesper.lemma.client.ClientModel
import io.github.mistvesper.lemma.theme.LemmaTheme
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.provider_model_list
import lemma.mobile.shared.generated.resources.provider_models_read_only
import org.jetbrains.compose.resources.stringResource

@Composable
internal fun PredefinedModelList(models: List<ClientModel>, modifier: Modifier = Modifier) {
    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = stringResource(Res.string.provider_model_list),
            style = LemmaTheme.typography.body.copy(fontWeight = FontWeight.Medium),
            color = LemmaTheme.colors.foreground,
        )
        Text(
            text = stringResource(Res.string.provider_models_read_only),
            style = LemmaTheme.typography.caption,
            color = LemmaTheme.colors.subtleForeground,
            modifier = Modifier.padding(top = 4.dp, bottom = 12.dp),
        )
        ModelFeatureList(models = models)
    }
}
