# Agent Note: Standard ACP session model selection

Status: implemented

English | [中文](2026-08-19-acp-session-model-selection.zh.md)

## Problem

The automation-only ACP bridge created every Agent from one deployment-wide provider/model pair and returned no session configuration. An ACP host could therefore run DeepSeek Harness but could not present the adapter-owned model directory or route one session through a user-selected model. Reimplementing that selector in each host would make the host guess Harness capabilities and would split configuration ownership across the protocol boundary.

The bridge must remain an automation transport, not regrow into an interactive product surface. Model selection also cannot mutate deployment-wide state, couple concurrent sessions, treat the advisory catalog as global request validation, or let prompt identity and request routing observe different models.

## Decision

`@deepseek-ai/dsh-acp` accepts an explicit `modelSelection: true` deployment option. At plugin startup it reads exactly one configured provider's adapter-owned `listModels()` catalog. Startup fails loud unless `provider` and `model` are present, the catalog is non-empty, and the configured default is a catalog member. Disabled deployments preserve the fixed-route behavior and do not expose `session/set_config_option`.

An enabled `session/new` returns one standard ACP select option with id and category `model`. Values preserve adapter order, ids, names, and descriptions; the bridge adds no host-specific metadata and no second catalog. Each new session owns an independent `ModelSelectionRef`, installed into that Agent's scope with `installModelSelection()`. The existing primitive snapshots one provider/model pair for prompt assembly and request routing, so `{{model}}` and the actual request remain aligned.

`session/set_config_option` accepts only the `model` option and an exact value from the startup catalog. Unknown option ids, booleans, unknown models, unknown sessions, and changes while a prompt is in flight reject without mutation. A successful change updates only the addressed session and returns the complete current option set. The choice becomes durable only when the existing request header records a model call; no parallel selection event or persistence source is introduced.

ACP image capability is connection-wide, while the model choice is session-local. An enabled bridge therefore advertises images only when the attachment store exists and every selectable route resolves with explicit image input. Per-prompt admission still checks the selected exact route.

`@deepseek-ai/dsh-acp-demo` forwards the opt-in. The ACP snapshot harness gains one `setModel` action, and an assembled keyless scenario pins discovery and a successful standard protocol update through the runnable app.

## Alternatives considered

**Build the selector in each ACP host.** Rejected because the host would have to invent model names, availability, and validation instead of rendering the Agent's standard protocol contract.

**Expose every configurable provider and model in the first change.** Rejected because the deployment already owns one provider route. A cross-provider selector would add grouping, credentials, and route-policy questions unrelated to restoring the missing model control.

**Add a generic configuration-contributor registry.** Rejected because one standard model option needs no new framework. The ACP Agent interface is the extension point; future options should be justified independently.

**Mutate `AgentOptions` or the global LLM runtime.** Rejected because those objects are creation- or deployment-scoped and would couple sessions. The existing Agent-scoped selection primitive already owns prompt/request consistency.

**Allow selection during an active prompt.** Rejected because a configuration operation should have one obvious turn boundary. The caller can change the model after the current prompt settles.

## Consequences

- ACP hosts render one official, typed option and contain no DeepSeek Harness model-selection special case.
- The adapter catalog is authoritative for what the selector offers, while catalog membership remains advisory outside this explicitly catalog-backed operation.
- Sessions are isolated; no model selection leaks across Agents or connections.
- Disabled deployments keep the small fixed-route ACP surface.
- Reasoning effort, modes, commands, session navigation, and other interactive features remain outside this automation transport.

## Testing

Protocol tests cover catalog projection, prompt/request routing, invalid values, startup failure, and multi-session isolation. The keyless assembled snapshot boots `dsh-acp-demo` through the real Loader and pins `session/new` plus `session/set_config_option` frames. Existing ACP lifecycle, content, permission, and cancellation suites remain unchanged.
