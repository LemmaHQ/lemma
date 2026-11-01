# Examples

Each "after" is current Lemma code, trimmed; each "before" is the heavier shape an agent tends to write first.

## Rust: guard with `let ... else`

From `crates/shared/lemma-agent-loop/src/tool_runtime.rs`.

Before: the happy path sits one level deep inside an `if let`, and the error arm is far from its condition.

```rust
pub(crate) async fn run(&self, call: &ToolCall) -> ToolOutcome {
    if let Some(tool) = self.registry.get(&call.name) {
        let result = tool.execute(call.arguments.clone(), &self.env).await;
        if result.is_ok() {
            let value = result.unwrap();
            ToolOutcome {
                text: serde_json::to_string_pretty(&value).unwrap_or_else(|_| value.to_string()),
                is_error: false,
            }
        } else {
            ToolOutcome::error(result.unwrap_err().to_string())
        }
    } else {
        ToolOutcome::error(format!("tool not found: {}", call.name))
    }
}
```

After: the missing-tool case returns first, and one `match` replaces the `is_ok` and `unwrap` pair.

```rust
pub(crate) async fn run(&self, call: &ToolCall) -> ToolOutcome {
    let Some(tool) = self.registry.get(&call.name) else {
        return ToolOutcome::error(format!("tool not found: {}", call.name));
    };
    match tool.execute(call.arguments.clone(), &self.env).await {
        Ok(value) => ToolOutcome {
            text: serde_json::to_string_pretty(&value).unwrap_or_else(|_| value.to_string()),
            is_error: false,
        },
        Err(e) => ToolOutcome::error(e.to_string()),
    }
}
```

## TypeScript: early return inside a map, `??` for a default

From `web/src/features/agent/agent-item.ts`.

Before: a mutable copy, a nested `if`, and a ternary that restates `??`.

```ts
toolCalls: entry.toolCalls.map((tc) => {
    let updated = tc;
    const res = resultByCallId.get(tc.id);
    if (res !== undefined) {
        if (res.content !== undefined) {
            updated = {
                ...tc,
                output: res.content,
                isError: res.toolIsError !== undefined ? res.toolIsError : false,
                state: "done",
            };
        }
    }
    return updated;
}),
```

After: no matching result returns the call unchanged; the rest is one object.

```ts
toolCalls: entry.toolCalls.map((tc) => {
    const res = resultByCallId.get(tc.id);
    if (res === undefined) {
        return tc;
    }
    return {
        ...tc,
        output: res.content,
        isError: res.toolIsError ?? false,
        state: "done",
    };
}),
```

The inner `res.content !== undefined` check in "before" guarded a state the type already excludes: `AgentItem.content` is a `string`. Confirm such a fact in the type definition before deleting a check.

## Kotlin: elvis and scope functions over null branches

From `mobile/shared/src/androidMain/kotlin/dev/lemmahq/lemma/engine/LocalEngine.kt`.

Before: explicit null branches and a one-use temporary.

```kotlin
private suspend fun transport(context: Context): Interceptor {
    val opened: LemmaEngine
    mutex.withLock {
        if (engine == null) {
            engine = LemmaEngine.open(context.filesDir.absolutePath)
        }
        opened = engine!!
    }
    return EngineInterceptor(opened)
}
```

```kotlin
val query = request.url.encodedQuery
val path = if (query != null) {
    request.url.encodedPath + "?" + query
} else {
    request.url.encodedPath
}
```

After: `?:` with `also` opens the engine once, without `!!`; `?.let` folds the optional query.

```kotlin
private suspend fun transport(context: Context): Interceptor =
    EngineInterceptor(
        mutex.withLock {
            engine ?: LemmaEngine.open(context.filesDir.absolutePath).also { engine = it }
        }
    )
```

```kotlin
val path = request.url.encodedPath + (request.url.encodedQuery?.let { "?$it" } ?: "")
```
