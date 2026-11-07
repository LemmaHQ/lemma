package dev.lemmahq.lemma.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaPasswordField
import dev.lemmahq.lemma.ui.components.LemmaTextField
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.auth_change_account
import lemma.mobile.shared.generated.resources.auth_confirm_password
import lemma.mobile.shared.generated.resources.auth_email
import lemma.mobile.shared.generated.resources.auth_identifier
import lemma.mobile.shared.generated.resources.auth_password
import lemma.mobile.shared.generated.resources.auth_username
import lemma.mobile.shared.generated.resources.icon_lock
import lemma.mobile.shared.generated.resources.icon_mail
import lemma.mobile.shared.generated.resources.icon_user
import org.jetbrains.compose.resources.painterResource
import org.jetbrains.compose.resources.stringResource

/** The fields of the auth [step]; each field shows its value and reports edits to its callback. */
@Composable
internal fun AuthFields(
    step: AuthStep,
    identifier: String,
    username: String,
    email: String,
    password: String,
    confirmation: String,
    enabled: Boolean,
    onIdentifierChange: (String) -> Unit,
    onUsernameChange: (String) -> Unit,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onConfirmationChange: (String) -> Unit,
    onChangeAccount: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        when (step) {
            AuthStep.Account ->
                LemmaTextField(
                    value = identifier,
                    onValueChange = onIdentifierChange,
                    placeholder = stringResource(Res.string.auth_identifier),
                    enabled = enabled,
                    leadingIcon = Res.drawable.icon_user,
                )
            AuthStep.Password -> {
                AccountRow(identifier = identifier.trim(), onChange = onChangeAccount)
                PasswordField(password, onPasswordChange, enabled)
            }
            else -> {
                LemmaTextField(
                    value = username,
                    onValueChange = onUsernameChange,
                    placeholder = stringResource(Res.string.auth_username),
                    enabled = enabled,
                    leadingIcon = Res.drawable.icon_user,
                )
                LemmaTextField(
                    value = email,
                    onValueChange = onEmailChange,
                    placeholder = stringResource(Res.string.auth_email),
                    enabled = enabled,
                    leadingIcon = Res.drawable.icon_mail,
                    keyboardType = KeyboardType.Email,
                )
                PasswordField(password, onPasswordChange, enabled)
                LemmaPasswordField(
                    value = confirmation,
                    onValueChange = onConfirmationChange,
                    placeholder = stringResource(Res.string.auth_confirm_password),
                    enabled = enabled,
                    leadingIcon = Res.drawable.icon_lock,
                )
            }
        }
    }
}

@Composable
private fun PasswordField(value: String, onValueChange: (String) -> Unit, enabled: Boolean) {
    LemmaPasswordField(
        value = value,
        onValueChange = onValueChange,
        placeholder = stringResource(Res.string.auth_password),
        enabled = enabled,
        leadingIcon = Res.drawable.icon_lock,
    )
}

/** The account the password step signs in to, with the action going back to change it. */
@Composable
private fun AccountRow(identifier: String, onChange: () -> Unit) {
    Row(
        modifier =
            Modifier.fillMaxWidth()
                .heightIn(min = 52.dp)
                .clip(LemmaTheme.shapes.medium)
                .background(LemmaTheme.colors.fill2)
                .padding(start = 16.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            painter = painterResource(Res.drawable.icon_user),
            contentDescription = null,
            tint = LemmaTheme.colors.textTertiary,
            modifier = Modifier.size(18.dp),
        )
        Spacer(modifier = Modifier.width(10.dp))
        Text(
            text = identifier,
            style = LemmaTheme.typography.bodyLarge,
            color = LemmaTheme.colors.textPrimary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = stringResource(Res.string.auth_change_account),
            style = LemmaTheme.typography.bodyMedium,
            color = LemmaTheme.colors.primary,
            modifier =
                Modifier.clip(LemmaTheme.shapes.medium)
                    .clickable(onClick = onChange)
                    .padding(horizontal = 12.dp, vertical = 8.dp),
        )
    }
}
