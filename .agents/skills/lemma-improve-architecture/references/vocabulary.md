# Architecture vocabulary

Design deep modules: a lot of behavior behind a small interface, placed at a clean seam, testable through that interface. The aim is leverage for callers, locality for maintainers, and testability for everyone.

## Terms

Use these terms exactly; do not substitute "component", "service", "API", "layer", "wrapper", or "boundary". Consistent language is the point.

- **Module**: anything with an interface and an implementation, at any scale: a function, a type, a crate, a feature store, or a slice spanning proto, RPC crate, and client. Avoid: unit, component, service.
- **Interface**: everything a caller must know to use the module correctly: the type signature, plus invariants, ordering constraints, error modes, required configuration, and performance characteristics. Avoid: API, signature.
- **Implementation**: the code inside a module. Distinct from adapter: a small adapter can have a large implementation (a SeaORM store), and a large adapter a small one (an in-memory fake).
- **Depth**: leverage at the interface, the behavior a caller or test can exercise per unit of interface it has to learn. A module is deep when much behavior sits behind a small interface, shallow when the interface is nearly as complex as the implementation.
- **Seam** (Michael Feathers): a place where behavior can change without editing that place; the location of a module's interface. Where the seam goes is its own decision, separate from what goes behind it. Avoid: boundary.
- **Adapter**: a concrete thing that satisfies an interface at a seam. It names a role, not substance.
- **Leverage**: what callers get from depth: more capability per unit of interface learned. One implementation pays back across N call sites and M tests.
- **Locality**: what maintainers get from depth: change, bugs, knowledge, and verification concentrate in one place. Fix once, fixed everywhere.

A module has exactly one interface. Depth is measured against it. A seam is where it lives; an adapter sits at the seam and satisfies it.

## Principles

- **Depth is a property of the interface, not the implementation.** A deep module can be composed internally of small, swappable parts; they are not part of its interface. A module can have internal seams, private to its implementation and used by its own tests, besides the external seam at its interface.
- **The deletion test.** Imagine deleting the module. If complexity vanishes, it was a pass-through. If complexity reappears across N callers, it was earning its keep.
- **The interface is the test surface.** Callers and tests cross the same seam. A test that has to reach past the interface signals a module of the wrong shape.
- **One adapter means a hypothetical seam; two adapters mean a real one.** Introduce a seam only where something actually varies across it.

When designing an interface, ask whether it can have fewer entry points, simpler parameters, and more complexity hidden inside.

## Rejected framings

- **Depth as the ratio of implementation lines to interface lines** (Ousterhout): rewards padding the implementation. Depth here is leverage.
- **Interface as a TypeScript `interface`, a Rust trait, or a type's public methods**: too narrow; the interface includes every fact a caller must know.
- **Boundary**: overloaded with the bounded context of domain-driven design. Say seam or interface.
