package dev.lemmahq.lemma.ui.auth

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.navigationevent.NavigationEventInfo
import androidx.navigationevent.compose.NavigationBackHandler
import androidx.navigationevent.compose.rememberNavigationEventState
import dev.lemmahq.lemma.client.Connection
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaFormSubmit
import lemma.mobile.shared.generated.resources.Res
import lemma.mobile.shared.generated.resources.auth_change_server
import lemma.mobile.shared.generated.resources.auth_connection_local
import lemma.mobile.shared.generated.resources.auth_connection_remote
import lemma.mobile.shared.generated.resources.auth_continue
import lemma.mobile.shared.generated.resources.auth_have_account
import lemma.mobile.shared.generated.resources.auth_no_account
import lemma.mobile.shared.generated.resources.auth_password_description
import lemma.mobile.shared.generated.resources.auth_password_title
import lemma.mobile.shared.generated.resources.auth_sign_in
import lemma.mobile.shared.generated.resources.auth_sign_in_description
import lemma.mobile.shared.generated.resources.auth_sign_in_title
import lemma.mobile.shared.generated.resources.auth_sign_up
import lemma.mobile.shared.generated.resources.auth_sign_up_description
import lemma.mobile.shared.generated.resources.auth_sign_up_title
import lemma.mobile.shared.generated.resources.auth_use_server
import lemma.mobile.shared.generated.resources.version_client
import lemma.mobile.shared.generated.resources.version_server
import org.jetbrains.compose.resources.stringResource

/**
 * Sign-in and sign-up over [connection]; the footer changes the connection and shows the versions
 * of the server and of this app, [appVersion].
 */
@Composable
internal fun AuthScreen(
    viewModel: AuthViewModel,
    connection: Connection,
    appVersion: String,
    onChangeConnection: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val step = viewModel.step
    NavigationBackHandler(
        state = rememberNavigationEventState(NavigationEventInfo.None),
        isBackEnabled = step != AuthStep.Account,
        onBackCompleted = viewModel::back,
    )

    Column(modifier = modifier.fillMaxSize().padding(24.dp)) {
        Column(
            modifier = Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            AuthHeading(step)
            Spacer(modifier = Modifier.height(24.dp))
            AuthFields(
                step = step,
                identifier = viewModel.identifier,
                username = viewModel.username,
                email = viewModel.email,
                password = viewModel.password,
                confirmation = viewModel.confirmation,
                enabled = !viewModel.busy,
                onIdentifierChange = viewModel::changeIdentifier,
                onUsernameChange = viewModel::changeUsername,
                onEmailChange = viewModel::changeEmail,
                onPasswordChange = viewModel::changePassword,
                onConfirmationChange = viewModel::changeConfirmation,
                onChangeAccount = viewModel::back,
            )
            LemmaFormSubmit(
                error = viewModel.error?.text(),
                busy = viewModel.busy,
                text =
                    stringResource(
                        when (step) {
                            AuthStep.Account -> Res.string.auth_continue
                            AuthStep.Password -> Res.string.auth_sign_in
                            AuthStep.SignUp -> Res.string.auth_sign_up
                        }
                    ),
                onSubmit = viewModel::submit,
            )
            Spacer(modifier = Modifier.height(16.dp))
            SwitchPrompt(
                signingUp = step == AuthStep.SignUp,
                onSignIn = viewModel::back,
                onSignUp = viewModel::showSignUp,
            )
        }
        AuthFooter(
            connection = connection,
            serverVersion = viewModel.serverVersion,
            appVersion = appVersion,
            onChangeConnection = onChangeConnection,
        )
    }
}

@Composable
private fun AuthHeading(step: AuthStep) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            text =
                stringResource(
                    when (step) {
                        AuthStep.Account -> Res.string.auth_sign_in_title
                        AuthStep.Password -> Res.string.auth_password_title
                        AuthStep.SignUp -> Res.string.auth_sign_up_title
                    }
                ),
            style = LemmaTheme.typography.titleLarge,
            color = LemmaTheme.colors.textPrimary,
            textAlign = TextAlign.Center,
        )
        Text(
            text =
                stringResource(
                    when (step) {
                        AuthStep.Account -> Res.string.auth_sign_in_description
                        AuthStep.Password -> Res.string.auth_password_description
                        AuthStep.SignUp -> Res.string.auth_sign_up_description
                    }
                ),
            style = LemmaTheme.typography.bodyMedium,
            color = LemmaTheme.colors.textSecondary,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun SwitchPrompt(signingUp: Boolean, onSignIn: () -> Unit, onSignUp: () -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            text =
                stringResource(
                    if (signingUp) Res.string.auth_have_account else Res.string.auth_no_account
                ),
            style = LemmaTheme.typography.bodyMedium,
            color = LemmaTheme.colors.textSecondary,
        )
        Text(
            text =
                stringResource(if (signingUp) Res.string.auth_sign_in else Res.string.auth_sign_up),
            style = LemmaTheme.typography.bodyMedium,
            color = LemmaTheme.colors.primary,
            modifier = Modifier.clickable(onClick = if (signingUp) onSignIn else onSignUp),
        )
    }
}

@Composable
private fun AuthFooter(
    connection: Connection,
    serverVersion: String?,
    appVersion: String,
    onChangeConnection: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text =
                    if (connection is Connection.Remote) {
                        stringResource(Res.string.auth_connection_remote, connection.serverUrl)
                    } else {
                        stringResource(Res.string.auth_connection_local)
                    },
                style = LemmaTheme.typography.labelSmall,
                color = LemmaTheme.colors.textTertiary,
            )
            Text(
                text =
                    stringResource(
                        when (connection) {
                            Connection.Local -> Res.string.auth_use_server
                            is Connection.Remote -> Res.string.auth_change_server
                        }
                    ),
                style = LemmaTheme.typography.labelSmall,
                color = LemmaTheme.colors.primary,
                modifier = Modifier.clickable(onClick = onChangeConnection),
            )
        }
        Text(
            text =
                listOfNotNull(
                        serverVersion?.let { stringResource(Res.string.version_server, it) },
                        stringResource(Res.string.version_client, appVersion),
                    )
                    .joinToString(" · "),
            style = LemmaTheme.typography.labelSmall,
            color = LemmaTheme.colors.textQuaternary,
        )
    }
}
