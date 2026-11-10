package dev.lemmahq.lemma.ui.components

import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import dev.lemmahq.lemma.theme.LemmaTheme
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.icon_eye
import lemma.mobile.shared.generated.resources.icon_eye_off
import lemma.mobile.shared.generated.resources.password_hide
import lemma.mobile.shared.generated.resources.password_show
import org.jetbrains.compose.resources.DrawableResource
import org.jetbrains.compose.resources.stringResource

@Composable
fun LemmaPasswordField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    enabled: Boolean = true,
    leadingIcon: DrawableResource? = null,
) {
    var visible by remember { mutableStateOf(false) }
    LemmaTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier,
        placeholder = placeholder,
        enabled = enabled,
        leadingIcon = leadingIcon,
        keyboardOptions =
            KeyboardOptions(autoCorrectEnabled = false, keyboardType = KeyboardType.Password),
        visualTransformation =
            if (visible) VisualTransformation.None else PasswordVisualTransformation(),
    ) {
        LemmaIconButton(
            icon = if (visible) Res.drawable.icon_eye_off else Res.drawable.icon_eye,
            contentDescription =
                stringResource(if (visible) Res.string.password_hide else Res.string.password_show),
            onClick = { visible = !visible },
            tint = LemmaTheme.colors.textSecondary,
        )
    }
}
