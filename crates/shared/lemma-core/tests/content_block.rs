//! Content blocks stored before timing fields existed.

use lemma_core::{ThinkingContent, ToolCall};

#[test]
fn blocks_stored_before_timing_load_without_timestamps() -> Result<(), serde_json::Error> {
    let thinking: ThinkingContent =
        serde_json::from_str(r#"{"thinking":"considering","signature":null}"#)?;
    let call: ToolCall =
        serde_json::from_str(r#"{"id":"call-1","name":"read_file","arguments":{}}"#)?;

    assert_eq!(thinking.started_at, None, "thinking start defaults");
    assert_eq!(thinking.finished_at, None, "thinking finish defaults");
    assert_eq!(call.started_at, None, "tool start defaults");
    assert_eq!(call.finished_at, None, "tool finish defaults");
    assert!(
        !serde_json::to_string(&call)?.contains("started_at"),
        "absent timestamps stay out of stored JSON"
    );
    Ok(())
}
