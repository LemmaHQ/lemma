# Distilled prose examples

Use these examples to identify the governing principle, not as text templates. "Balanced" preserves every load-bearing proposition with the least explanation needed at that location.

## Preserve every factual clause

**Original:** "Deleting a provider deliberately leaves historical rows intact: `messages.provider_id` has no foreign key, so past turns keep their provider ID even after the provider is removed."

**Over-trimmed:** "Past turns keep their provider ID."

**Balanced:** "`messages.provider_id` has no foreign key so deleting a provider preserves historical turns."

Remove decoration and repetition, not propositions. The missing foreign key and the preservation of historical turns are separate facts.

## Explicit skill scope is functional

**Over-trimmed:** "Read the sources and use judgment."

**Balanced:** "This skill is guidance, not a script. Use judgment beyond the named checks; documented requirements still apply."

Keep the explicit limitation because it changes how an agent applies the workflow. Trim repeated persuasion, not the guardrail.

## Preserve ownership and timing

**Over-trimmed:** "The loop writes a placeholder for each step."

**Balanced:** "Each step appends an assistant message with status `streaming` before calling the model and settles it with the final content, status, and usage afterwards."

Ordering relative to the model call and the fields settled afterwards are caller-visible: a client reading the tree mid-step sees the placeholder.

## Doc comments include failures

**Over-trimmed:** "Opens a sealed key."

**Balanced:** "Decrypts a provider API key sealed under the current secret key. Fails when the key was sealed under a different secret key; changing the secret key makes every sealed key unreadable."

Errors and their preconditions are caller-visible contract facts.

## A missing component is behavior

**Over-trimmed:** "`ToolRuntime` is optional."

**Balanced:** "A loop without a `ToolRuntime` sends no tool definitions, so the model cannot request tool calls."

What the absence does is the contract; that the field is optional is already in the type.

## Keep a concise mapping

**Over-trimmed:** "Maps errors to messages."

**Balanced:** "Translates the `ErrorReason` detail when one is present, then falls back by Connect code for network, timeout, and authentication failures, and to the unspecified message otherwise."

Keep the precedence and the fallback; let the table show its own entries.

## Delete reasoning transcripts entirely

**Over-detailed:** "First the handler checks whether the session is running. If it is, the next branch rejects the turn. Otherwise it starts a new turn, which is why only one turn runs at a time."

**Balanced:** No comment when the code already expresses those branches. If the guard protects a non-obvious invariant, state only that invariant at the owner: "Only one turn runs per session at a time."

Do not compress a reasoning transcript into shorter narration; remove it.

## Rationale goes to the commit body

**Over-detailed:** A code comment explaining why a generator skips a check and which alternative was rejected.

**Balanced:** No comment. The commit body states the decision and the rejected alternative; the generator's README lists the checks it does run.

## Configuration comments explain what the file cannot

**Over-detailed:** "This step installs dependencies, then runs the lint, then runs the pairing check," above steps whose names already say so.

**Balanced:** No comment, or one line where order or a workaround has a consequence: "The token generator runs before the build because Vite imports the generated CSS."

## Do not trim for word count alone

**Current:** "Each adapter translates its vendor's stream into stream events, so the loop handles text, thinking, and tool calls the same way for every API format."

**Shorter but worse:** "Adapters normalize streams."

Keep the fuller sentence unless a link or surrounding contract already lists the event kinds.

## Model-visible text is behavior

**Over-trimmed:** Rewording a `ToolSpec` description in a prose-only pass because it reads awkwardly.

**Balanced:** Leave model-visible wording unchanged in a prose-only pass and report it. Change it in a task that owns tool behavior, state the change in the commit body, and exercise it in a session against a real provider.

## Limitations are contracts, not debt inventories

**Over-trimmed:** Omitting that changing the secret key makes every stored provider key unreadable.

**Over-detailed:** Listing private helpers to rename with no caller or maintainer consequence.

**Balanced:** Keep the secret-key consequence in the README or doc comment; open a GitHub issue for ordinary cleanup.
