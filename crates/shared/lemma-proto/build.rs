//! Build script: compiles the proto contracts into Connect bindings.

use std::error::Error;

fn main() -> Result<(), Box<dyn Error>> {
    connectrpc_build::Config::new()
        .files(&[
            "../../../proto/lemma/v1/auth.proto",
            "../../../proto/lemma/v1/errors.proto",
            "../../../proto/lemma/v1/provider.proto",
            "../../../proto/lemma/v1/conversation.proto",
            "../../../proto/lemma/v1/agent.proto",
        ])
        .includes(&["../../../proto"])
        .include_file("_connectrpc.rs")
        .compile()?;
    Ok(())
}
