use jni::errors::{Error, ThrowRuntimeExAndDefault};
use jni::objects::{JClass, JObject};
use jni::{Env, EnvUnowned};

/// Native side of `PlatformVerifier.init` in `dev.lemmahq.lemma.engine`:
/// hands the Android application context to `rustls-platform-verifier`, which
/// checks the engine's TLS certificates against the system trust store.
/// Throws `RuntimeException` when the JNI calls fail.
#[unsafe(no_mangle)]
pub extern "system" fn Java_dev_lemmahq_lemma_engine_PlatformVerifier_init<'caller>(
    mut env: EnvUnowned<'caller>,
    _class: JClass<'caller>,
    context: JObject<'caller>,
) {
    env.with_env(|env| install(env, context))
        .resolve::<ThrowRuntimeExAndDefault>();
}

#[cfg(target_os = "android")]
fn install(env: &mut Env<'_>, context: JObject<'_>) -> Result<(), Error> {
    use rustls_platform_verifier::android;

    android::init_with_env(env, context)
}

/// Desktop platforms read their trust store without setup.
#[cfg(not(target_os = "android"))]
fn install(_env: &mut Env<'_>, _context: JObject<'_>) -> Result<(), Error> {
    Ok(())
}
