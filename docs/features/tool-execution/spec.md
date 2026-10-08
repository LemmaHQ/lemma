# Tool Execution

## Summary

Tool Execution provides tools, execution environments, and safety approval policies for agent interactions.
The shared tools domain (`lemma-tools`) governs tool specifications, permission tier gating, sandboxed local execution, and streaming result serialization.

## Requirements

### Tool specifications and registry

- THE SYSTEM SHALL define tool capabilities via `ToolSpec` records containing tool names, descriptions, and JSON Schema parameter schemas.
- THE SYSTEM SHALL register enabled tool instances in a thread-safe `ToolRegistry`.
- THE SYSTEM SHALL provide query interfaces for retrieving active tool specifications formatted for upstream model invocation.

### Safety approval and capability tiers

- THE SYSTEM SHALL classify each tool into a capability tier: Read for read-only inspection, Write for state-mutating file modifications, and Exec for shell execution.
- WHEN a tool invocation is initiated, THE SYSTEM SHALL evaluate invocation parameters against an `ApprovalPolicy` prior to execution.
- THE SYSTEM SHALL support approval decisions: Allow to proceed immediately, Prompt to request operator confirmation, and Deny to reject execution.

### Execution environment and built-in tools

- THE SYSTEM SHALL execute tool actions within an abstract `ExecEnv` execution environment.
- THE SYSTEM SHALL provide built-in tools for local filesystem inspection (`read_file`), filesystem modification (`write_file`), and shell command execution (`bash`).
- WHEN executing shell commands, THE SYSTEM SHALL capture standard output, standard error, exit codes, and timing marks.

### Stream events and result recording

- WHEN a tool call commences, THE SYSTEM SHALL emit a tool call started event containing the call identifier, tool name, and serialized arguments.
- WHEN a tool execution concludes, THE SYSTEM SHALL emit a tool call finished event containing the call identifier, execution output, and failure status.
- THE SYSTEM SHALL append a tool result message to the conversation message tree, referencing the tool call identifier and recording execution metadata.
