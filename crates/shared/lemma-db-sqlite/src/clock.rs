use std::time::{SystemTime, UNIX_EPOCH};

/// Current time in Unix milliseconds, the timestamp encoding of every
/// table.
pub(crate) fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| i64::try_from(d.as_millis()).unwrap_or(i64::MAX))
}
