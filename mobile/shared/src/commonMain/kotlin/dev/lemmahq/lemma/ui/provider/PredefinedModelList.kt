package dev.lemmahq.lemma.ui.provider

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.client.ClientModel
import dev.lemmahq.lemma.theme.LemmaTheme
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.provider_model_list
import lemma.mobile.shared.generated.resources.provider_models_read_only
import org.jetbrains.compose.resources.stringResource

@Composable
internal fun PredefinedModelList(models: List<ClientModel>, modifier: Modifier = Modifier) {
    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = stringResource(Res.string.provider_model_list),
            style = LemmaTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium),
            color = LemmaTheme.colors.textPrimary,
        )
        Text(
            text = stringResource(Res.string.provider_models_read_only),
            style = LemmaTheme.typography.labelSmall,
            color = LemmaTheme.colors.textTertiary,
            modifier = Modifier.padding(top = 4.dp, bottom = 12.dp),
        )
        ModelFeatureList(models = models)
    }
}
