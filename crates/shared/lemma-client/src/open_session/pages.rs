use chrono::{DateTime, Utc};
use lemma_proto::lemma::v1::ListMessagesResponse;

use crate::ClientError;
use crate::message_item::{
    MessageError, MessageItem, MessageRole, MessageStatus, hydrate_tool_results,
};

/// The loaded messages and active turn of one open session.
#[derive(Debug)]
pub struct OpenSession {
    pub(super) session_id: String,
    pub(super) items: Vec<MessageItem>,
    pub(super) has_older: bool,
    pub(super) next_local_id: usize,
    pub(super) current_reply: Option<usize>,
    pub(super) optimistic_user: Option<usize>,
}

impl OpenSession {
    /// Opens a session from a newest-first page, storing its items oldest first.
    #[must_use]
    pub fn new(session_id: &str, page: ListMessagesResponse) -> Self {
        let (items, has_older) = Self::page_items(page);
        Self {
            session_id: session_id.to_owned(),
            items,
            has_older,
            next_local_id: 0,
            current_reply: None,
            optimistic_user: None,
        }
    }

    /// The identifier of this session.
    #[must_use]
    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    /// Every loaded non-tool item, oldest first.
    pub fn messages(&self) -> impl Iterator<Item = &MessageItem> {
        self.items
            .iter()
            .filter(|item| item.role != MessageRole::Tool)
    }

    /// Whether the last older-page load reported more history.
    #[must_use]
    pub fn has_older(&self) -> bool {
        self.has_older
    }

    /// The oldest loaded item's identifier, including tool items.
    #[must_use]
    pub fn oldest_id(&self) -> Option<&str> {
        self.items.first().map(|item| item.id.as_str())
    }

    /// Prepends a newest-first older page and refreshes tool-result hydration.
    pub fn prepend_older(&mut self, page: ListMessagesResponse) {
        let (mut older, has_older) = Self::page_items(page);
        let added = older.len();
        older.append(&mut self.items);
        self.items = older;
        hydrate_tool_results(&mut self.items);
        self.has_older = has_older;
        if let Some(index) = &mut self.current_reply {
            *index += added;
        }
        if let Some(index) = &mut self.optimistic_user {
            *index += added;
        }
    }

    /// Replaces all history with the newest page and ends local turn state.
    pub fn reload(&mut self, page: ListMessagesResponse) {
        let (items, has_older) = Self::page_items(page);
        self.items = items;
        self.has_older = has_older;
        self.current_reply = None;
        self.optimistic_user = None;
    }

    /// Appends an optimistic user message and its blank streaming reply.
    pub fn begin_turn(&mut self, content: &str, provider_id: &str, model: &str) {
        let user_index = self.items.len();
        let user_id = self.local_id();
        self.items.push(MessageItem::local(
            user_id,
            MessageRole::User,
            content,
            MessageStatus::Done,
            "",
            "",
        ));
        self.optimistic_user = Some(user_index);
        let reply_index = self.items.len();
        let reply_id = self.local_id();
        self.items
            .push(Self::streaming_reply(reply_id, provider_id, model));
        self.current_reply = Some(reply_index);
    }

    /// The last user message with a streaming item after it and no live local turn.
    #[must_use]
    pub fn running_turn(&self) -> Option<&str> {
        self.interrupted_turn()
            .map(|(user_index, _)| self.items[user_index].id.as_str())
    }

    /// Replaces an interrupted turn's later items with a fresh streaming reply.
    pub fn resume_turn(&mut self) -> Option<String> {
        let (user_index, reply_index) = self.interrupted_turn()?;
        let user_id = self.items[user_index].id.clone();
        let provider_id = self.items[reply_index].provider_id.clone();
        let model = self.items[reply_index].model.clone();
        self.items.truncate(user_index + 1);
        let reply_index = self.items.len();
        let reply_id = self.local_id();
        self.items
            .push(Self::streaming_reply(reply_id, &provider_id, &model));
        self.current_reply = Some(reply_index);
        self.optimistic_user = None;
        Some(user_id)
    }

    /// Whether a reply is currently receiving turn events.
    #[must_use]
    pub fn turn_running(&self) -> bool {
        self.current_reply.is_some()
    }

    /// Marks the current reply with a client-side failure and ends the turn.
    pub fn fail(&mut self, error: ClientError) {
        let Some(index) = self.current_reply.take() else {
            return;
        };
        let reply = &mut self.items[index];
        reply.status = MessageStatus::Error;
        reply.error = Some(MessageError::Client(error));
        Self::close_thinking(reply, None);
        self.optimistic_user = None;
    }

    /// Marks the current reply aborted before the service starts the turn.
    pub fn cancel_turn(&mut self) {
        let Some(index) = self.current_reply.take() else {
            return;
        };
        let reply = &mut self.items[index];
        reply.status = MessageStatus::Aborted;
        Self::close_thinking(reply, None);
        self.optimistic_user = None;
    }

    pub(super) fn streaming_reply(id: String, provider_id: &str, model: &str) -> MessageItem {
        MessageItem::local(
            id,
            MessageRole::Assistant,
            "",
            MessageStatus::Streaming,
            provider_id,
            model,
        )
    }

    pub(super) fn close_thinking(reply: &mut MessageItem, at: Option<DateTime<Utc>>) {
        if reply.thinking_started_at.is_some() && reply.thinking_finished_at.is_none() {
            reply.thinking_finished_at = at;
        }
    }

    fn page_items(page: ListMessagesResponse) -> (Vec<MessageItem>, bool) {
        let ListMessagesResponse {
            messages, has_more, ..
        } = page;
        let mut items: Vec<MessageItem> =
            messages.into_iter().rev().map(MessageItem::from).collect();
        hydrate_tool_results(&mut items);
        (items, has_more)
    }

    fn local_id(&mut self) -> String {
        let id = format!("local-{}", self.next_local_id);
        self.next_local_id += 1;
        id
    }

    fn interrupted_turn(&self) -> Option<(usize, usize)> {
        if self.current_reply.is_some() {
            return None;
        }
        let user_index = self
            .items
            .iter()
            .rposition(|item| item.role == MessageRole::User)?;
        let reply_index = self
            .items
            .iter()
            .enumerate()
            .skip(user_index + 1)
            .rev()
            .find(|(_, item)| item.status == MessageStatus::Streaming)?
            .0;
        Some((user_index, reply_index))
    }
}
