//! Web search and fetch backends over an injected HTTP transport.

mod deepseek;
mod exa;
mod native;
mod post_json;

pub use self::deepseek::DeepSeekWebBackend;
pub use self::exa::ExaWebBackend;
pub use self::native::NativeWebBackend;
