use lemma_proto::lemma::v1::{
    CreateSessionRequest, DeleteSessionRequest, ListMessagesRequest, ListMessagesResponse,
    ListSessionsRequest, RenameSessionRequest, Session,
};

use crate::client::Client;
use crate::client_error::ClientError;
use crate::token_store::TokenStore;

const MESSAGE_PAGE_SIZE: i32 = 50;

impl<S: TokenStore> Client<S> {
    /// The user's sessions.
    ///
    /// # Errors
    ///
    /// The call's [`ClientError`].
    pub async fn list_sessions(&self) -> Result<Vec<Session>, ClientError> {
        let sessions = &self.inner.sessions;
        let response = self
            .authorized(async |options| {
                let request = ListSessionsRequest::default();
                sessions.list_sessions_with_options(request, options).await
            })
            .await?;
        Ok(response.into_owned().sessions)
    }

    /// Creates an empty session.
    ///
    /// # Errors
    ///
    /// The call's [`ClientError`].
    pub async fn create_session(&self) -> Result<Session, ClientError> {
        let sessions = &self.inner.sessions;
        let response = self
            .authorized(async |options| {
                let request = CreateSessionRequest::default();
                sessions.create_session_with_options(request, options).await
            })
            .await?;
        Ok(response
            .into_owned()
            .session
            .into_option()
            .unwrap_or_default())
    }

    /// Renames a session.
    ///
    /// # Errors
    ///
    /// The call's [`ClientError`].
    pub async fn rename_session(&self, id: &str, title: &str) -> Result<Session, ClientError> {
        let sessions = &self.inner.sessions;
        let response = self
            .authorized(async |options| {
                let request = RenameSessionRequest {
                    id: id.to_owned(),
                    title: title.trim().to_owned(),
                    ..Default::default()
                };
                sessions.rename_session_with_options(request, options).await
            })
            .await?;
        Ok(response
            .into_owned()
            .session
            .into_option()
            .unwrap_or_default())
    }

    /// Deletes a session with all its messages.
    ///
    /// # Errors
    ///
    /// The call's [`ClientError`].
    pub async fn delete_session(&self, id: &str) -> Result<(), ClientError> {
        let sessions = &self.inner.sessions;
        self.authorized(async |options| {
            let request = DeleteSessionRequest {
                id: id.to_owned(),
                ..Default::default()
            };
            sessions.delete_session_with_options(request, options).await
        })
        .await?;
        Ok(())
    }

    /// One page of a session's messages, newest first: the newest page, or the page before `before_id`.
    ///
    /// # Errors
    ///
    /// The call's [`ClientError`].
    pub async fn list_messages(
        &self,
        session_id: &str,
        before_id: Option<&str>,
    ) -> Result<ListMessagesResponse, ClientError> {
        let sessions = &self.inner.sessions;
        let response = self
            .authorized(async |options| {
                let request = ListMessagesRequest {
                    session_id: session_id.to_owned(),
                    before_id: before_id.unwrap_or_default().to_owned(),
                    limit: MESSAGE_PAGE_SIZE,
                    ..Default::default()
                };
                sessions.list_messages_with_options(request, options).await
            })
            .await?;
        Ok(response.into_owned())
    }
}
