# Agent instructions

## Delegating to Codex workers

- Use the non-interactive `codex exec` subcommand for delegated Codex work. The
  syntax is `codex exec`, not `-exec`.
- For delegated tasks that are explicitly read-only, invoke the worker with
  `--sandbox read-only` and state clearly in the prompt that it must not modify
  files, run mutating commands, or create artifacts.
- For delegated implementation work that is intentionally allowed to change
  this repository, use `--sandbox workspace-write` and keep the prompt scoped
  to the requested files and behavior.
- Do not use the deprecated `--full-auto` flag or
  `--dangerously-bypass-approvals-and-sandbox` for delegation.
- Pass the repository as the worker's working directory with `--cd`/`-C` when
  the caller is not already running from the repository root.
