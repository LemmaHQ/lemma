# Conversation Management

## Summary

Conversation Management manages the lifecycle of chat conversations and the structured tree of messages within them.
The shared conversation domain (`lemma-conversation`) governs conversation creation, renaming, archiving, restoring, deletion, and keyset-paginated message retrieval across storage backends.

## Requirements

### Conversation lifecycle

- THE SYSTEM SHALL isolate conversation records per authenticated user account.
- WHEN a user creates a conversation, THE SYSTEM SHALL initialize an active conversation record with created and updated timestamps.
- WHEN a user renames a conversation, THE SYSTEM SHALL update the title with the trimmed input string provided the title contains non-whitespace characters.
- WHEN an authenticated user lists active conversations, THE SYSTEM SHALL return all active conversations owned by that user.
- WHEN a user archives an active conversation, THE SYSTEM SHALL transition the conversation status to archived and record the archive timestamp while keeping all existing messages intact.
- WHEN a user restores an archived conversation, THE SYSTEM SHALL transition the conversation status back to active and clear the archive timestamp.
- WHEN an authenticated user requests archived conversations, THE SYSTEM SHALL return all archived conversations owned by that user.
- WHEN a user deletes an archived conversation, THE SYSTEM SHALL permanently remove the conversation and cascade deletion across all associated message rows.

### Message structure and tree hierarchy

- THE SYSTEM SHALL store messages with declared roles: user, assistant, system, and tool.
- THE SYSTEM SHALL represent message lineage as a tree by assigning each child message a parent message identifier, leaving the parent identifier empty for root messages.
- For assistant messages, THE SYSTEM SHALL record the generating provider identifier, model name, lifecycle status, thinking text, error description, and tool call blocks.
- For tool messages, THE SYSTEM SHALL associate the execution result with the originating tool call identifier and name.
- THE SYSTEM SHALL track message lifecycle states through distinct statuses: streaming, done, aborted, and error.

### Keyset message retrieval

- WHEN a client requests messages for a conversation, THE SYSTEM SHALL verify conversation ownership before retrieving messages.
- THE SYSTEM SHALL return messages sorted newest-first according to creation time and identifier.
- WHEN a message query specifies an anchor identifier, THE SYSTEM SHALL page backwards into history returning messages created prior to that anchor.
- THE SYSTEM SHALL clamp the requested message pagination limit between a default of 50 and a maximum of 100 entries.
- THE SYSTEM SHALL include a boolean indicator in the response denoting whether earlier historical messages remain available.

### Service interface

- THE SERVER SHALL expose conversation operations over ConnectRPC via the `ConversationService` interface: ListConversations, CreateConversation, RenameConversation, ListMessages, ArchiveConversation, RestoreConversation, ListArchived, and DeleteArchived.
- THE SYSTEM SHALL require authentication for all ConversationService endpoints.
