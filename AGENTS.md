# Agent instructions

## Delegating to Codex workers

Delegate whenever executing an implementation plan or document. The primary agent owns integration and verification. Do not let delegated agents delegate again.

### Model routing

* **Sonnet:** CSS, responsive layouts, components, accessibility, design systems, animations, and substantial UI implementation.
* **Haiku:** CSS audits, small styling tasks, repetitive UI cleanup, and visual checks.
* **GPT-5.6 Terra:** API architecture, service boundaries, databases, authentication, migrations, concurrency, and complex backend work.
* **GPT-5.6 Luna:** CRUD, schemas, validation, adapters, fixtures, tests, and other bounded backend tasks.
* **Sol or Opus:** Planning, ambiguous cross-cutting work, integration, security-sensitive decisions, and final review.

### Execution

Prefer native subagents. Otherwise run terminal workers non-interactively:

```sh
codex exec --ephemeral --model gpt-5.6-terra --sandbox workspace-write "<task>"
codex exec --ephemeral --model gpt-5.6-luna --sandbox workspace-write "<task>"
claude -p --model sonnet --permission-mode acceptEdits "<task>"
claude -p --model haiku --permission-mode acceptEdits "<task>"
```

Give each worker a bounded scope, acceptance criteria, verification commands, and instructions not to delegate further. Use separate worktrees for concurrent writers.

If delegation fails, report the exact error and continue locally. Never weaken permissions automatically.

### codex vs claude

When running in Codex, use native subagents for GPT models and terminal commands for Claude models. When running in Claude Code, use native subagents for Claude models and `codex exec` for GPT models.
