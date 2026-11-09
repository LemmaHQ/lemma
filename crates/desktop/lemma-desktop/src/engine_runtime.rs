use std::io;
use std::mem::ManuallyDrop;
use std::pin::Pin;
use std::task::{Context, Poll};

use gpui_kit::{App, AppContext, Global, Task};
use tokio::runtime::{Builder, Handle, Runtime};

/// The tokio runtime that runs the local engine and the client's calls; GPUI tasks await their futures through [`EngineRuntime::run`].
#[derive(Debug)]
pub struct EngineRuntime {
    runtime: Runtime,
}

impl Global for EngineRuntime {}

impl EngineRuntime {
    /// Starts a multi-threaded runtime with I/O and timers.
    ///
    /// # Errors
    ///
    /// The I/O error when the runtime's threads cannot start.
    pub fn new() -> io::Result<Self> {
        let runtime = Builder::new_multi_thread()
            .enable_all()
            .thread_name("lemma-engine")
            .build()?;
        Ok(Self { runtime })
    }

    /// `future`, polled and dropped inside this runtime's context so it can use tokio I/O, timers, and spawning from any executor.
    #[must_use]
    pub fn run<F: Future>(&self, future: F) -> InRuntime<F> {
        InRuntime {
            handle: self.runtime.handle().clone(),
            future: ManuallyDrop::new(Box::pin(future)),
        }
    }

    /// Runs `future` on a GPUI background thread inside the global runtime's context.
    pub fn spawn<F>(future: F, cx: &App) -> Task<F::Output>
    where
        F: Future + Send + 'static,
        F::Output: Send + 'static,
    {
        cx.background_spawn(cx.global::<Self>().run(future))
    }
}

/// A future polled and dropped inside a tokio runtime's context.
#[derive(Debug)]
pub struct InRuntime<F> {
    handle: Handle,
    future: ManuallyDrop<Pin<Box<F>>>,
}

impl<F: Future> Future for InRuntime<F> {
    type Output = F::Output;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<F::Output> {
        let this = self.get_mut();
        let _context = this.handle.enter();
        this.future.as_mut().poll(cx)
    }
}

impl<F> Drop for InRuntime<F> {
    fn drop(&mut self) {
        let _context = self.handle.enter();
        // SAFETY: `future` is dropped only here, once, and `self` is not used afterwards.
        unsafe { ManuallyDrop::drop(&mut self.future) };
    }
}
