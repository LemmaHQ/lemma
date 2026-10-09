//! Standalone UniFFI bindings generator, invocable via
//! `cargo run -p lemma-mobile --features bindgen --bin uniffi-bindgen`.

fn main() {
    uniffi::uniffi_bindgen_main();
}
