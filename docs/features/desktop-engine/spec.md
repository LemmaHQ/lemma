# Desktop Sidecar Engine

## Summary

The Desktop Sidecar Engine manages the embedded Rust backend process that powers Lemma Desktop in local mode.
The Electron shell (`desktop/src/engine.ts`) controls the process lifecycle, loopback communication, readiness handshakes, and graceful termination.

## Requirements

### Engine lifecycle and configuration

- WHEN the desktop application starts, THE SYSTEM SHALL spawn the compiled `lemma-server` binary as a child process.
- THE SYSTEM SHALL configure the child process environment with `LEMMA_LOCAL_MODE=1` and assign `LEMMA_DATA_DIR` to the application user data directory.
- THE SYSTEM SHALL locate the binary in application resources in packaged releases, or relative target build directories during local development.

### Ephemeral loopback binding

- THE ENGINE SHALL bind its TCP listener to the loopback interface at address `127.0.0.1` using port 0 to allocate a dynamic ephemeral port.
- THE ENGINE SHALL serve ConnectRPC endpoints and embedded web assets over the allocated loopback port.

### Readiness handshake and provisioning

- WHEN initialization completes, THE ENGINE SHALL emit a readiness announcement on standard output prefixed with the `LEMMA_READY` marker containing a JSON payload with the bound port, default username, and default password.
- THE DESKTOP SHELL SHALL parse the readiness payload and resolve the engine service URL within a ten-second startup deadline.
- WHERE operating in local mode, THE ENGINE SHALL provision a default local account in the SQLite storage backend upon initial launch.

### Termination and cleanup

- WHEN the desktop application initiates shutdown, THE SYSTEM SHALL close the engine process standard input stream to request graceful termination.
- THE SYSTEM SHALL allow a three-second grace period for the engine process to exit cleanly before issuing a termination signal.
