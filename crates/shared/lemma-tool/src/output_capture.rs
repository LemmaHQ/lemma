use std::collections::VecDeque;

use tokio::io::{AsyncRead, AsyncReadExt};

const KEPT_BYTES: usize = 16 * 1024;

#[derive(Debug, Default)]
pub(crate) struct OutputCapture {
    head: Vec<u8>,
    tail: VecDeque<u8>,
    omitted: usize,
}

impl OutputCapture {
    pub(crate) async fn read<R: AsyncRead + Unpin>(mut stream: Option<R>) -> Self {
        let mut capture = Self::default();
        let mut buf = [0u8; 8192];
        while let Some(stream) = stream.as_mut()
            && let Ok(read @ 1..) = stream.read(&mut buf).await
        {
            capture.push(&buf[..read]);
        }
        capture
    }

    fn push(&mut self, bytes: &[u8]) {
        let head_room = KEPT_BYTES - self.head.len();
        let (head, rest) = bytes.split_at(head_room.min(bytes.len()));
        self.head.extend_from_slice(head);
        self.tail.extend(rest);
        let excess = self.tail.len().saturating_sub(KEPT_BYTES);
        self.tail.drain(..excess);
        self.omitted += excess;
    }

    pub(crate) fn into_text(self) -> String {
        let head = String::from_utf8_lossy(&self.head);
        let tail = Vec::from(self.tail);
        let tail = String::from_utf8_lossy(&tail);
        if self.omitted == 0 {
            return format!("{head}{tail}");
        }
        format!("{head}\n[{} bytes omitted]\n{tail}", self.omitted)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn output_within_both_ends_is_kept_whole() {
        let mut capture = OutputCapture::default();
        capture.push(&[b'a'; KEPT_BYTES]);
        capture.push(&[b'b'; KEPT_BYTES]);

        let text = capture.into_text();

        assert_eq!(text.len(), 2 * KEPT_BYTES, "nothing omitted");
        assert!(!text.contains("omitted"), "no marker");
    }

    #[test]
    fn output_past_both_ends_keeps_the_first_and_last_bytes() {
        let mut capture = OutputCapture::default();
        capture.push(&[b'a'; KEPT_BYTES + 10]);
        capture.push(&[b'b'; KEPT_BYTES]);
        capture.push(b"end");

        let text = capture.into_text();

        let head = "a".repeat(KEPT_BYTES);
        let tail = format!("{}end", "b".repeat(KEPT_BYTES - 3));
        assert_eq!(
            text,
            format!("{head}\n[13 bytes omitted]\n{tail}"),
            "kept ends"
        );
    }
}
