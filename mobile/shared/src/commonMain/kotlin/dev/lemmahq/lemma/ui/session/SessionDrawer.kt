package dev.lemmahq.lemma.ui.session

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import dev.lemmahq.lemma.client.ClientSession
import dev.lemmahq.lemma.theme.LemmaTheme
import dev.lemmahq.lemma.ui.components.LemmaButton
import dev.lemmahq.lemma.ui.components.LemmaButtonVariant

@Composable
internal fun SessionDrawer(
    sessions: List<ClientSession>,
    currentSessionId: String?,
    isLoading: Boolean,
    onNewSession: () -> Unit,
    onSelectSession: (ClientSession) -> Unit,
    onManageProviders: () -> Unit,
    onSignOut: () -> Unit,
) {
    ModalDrawerSheet(
        drawerContainerColor = LemmaTheme.colors.backgroundGroup,
        modifier = Modifier.width(280.dp),
    ) {
        Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
            Text(
                text = "Sessions",
                style = LemmaTheme.typography.titleLarge,
                color = LemmaTheme.colors.textPrimary,
            )

            Spacer(modifier = Modifier.height(16.dp))

            LemmaButton(
                text = "+ New session",
                onClick = onNewSession,
                modifier = Modifier.fillMaxWidth(),
                variant = LemmaButtonVariant.Primary,
            )

            Spacer(modifier = Modifier.height(16.dp))

            if (isLoading) {
                CircularProgressIndicator(
                    color = LemmaTheme.colors.primary,
                    modifier = Modifier.size(24.dp).align(Alignment.CenterHorizontally),
                )
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    items(sessions, key = { it.id }) { conv ->
                        val isSelected = conv.id == currentSessionId
                        Box(
                            modifier =
                                Modifier.fillMaxWidth()
                                    .clip(LemmaTheme.shapes.medium)
                                    .background(
                                        if (isSelected) LemmaTheme.colors.fill2
                                        else LemmaTheme.colors.fill1
                                    )
                                    .clickable { onSelectSession(conv) }
                                    .padding(horizontal = 12.dp, vertical = 10.dp)
                        ) {
                            Text(
                                text = conv.title.ifBlank { "New session" },
                                style = LemmaTheme.typography.bodyMedium,
                                color =
                                    if (isSelected) LemmaTheme.colors.textPrimary
                                    else LemmaTheme.colors.textSecondary,
                                maxLines = 1,
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            LemmaButton(
                text = "Providers",
                onClick = onManageProviders,
                modifier = Modifier.fillMaxWidth(),
                variant = LemmaButtonVariant.Secondary,
            )

            Spacer(modifier = Modifier.height(8.dp))

            LemmaButton(
                text = "Sign Out",
                onClick = onSignOut,
                modifier = Modifier.fillMaxWidth(),
                variant = LemmaButtonVariant.Secondary,
            )
        }
    }
}
