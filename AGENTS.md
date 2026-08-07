# Agent instructions

## Verification

```sh
nvm use && pnpm verify
```

`pnpm verify` is the **only** gate: lockfile integrity → `build:packages` → `check` → `lint` →
`test:unit` → `build`. CI runs it, Railway runs it as its build command, and Railway has *Wait for
CI* enabled, so a green `verify` on the pinned Node is the whole contract. Never hand-run a subset
of its steps and call a change verified — a passing `pnpm check && pnpm test:unit` is not a passing
build.

If the gate needs a new step, add it to the `verify` script in the root `package.json` and nowhere
else. Do not add steps to `.github/workflows/ci.yml` or `build:railway` directly; they delegate, and
editing them separately is exactly how this pipeline has drifted before.

Three rules, each of which has broken a deploy at least once:

* **Node comes from `.nvmrc` (22.23.2) and nowhere else.** Run `nvm use` first — the system default
  is older and below the engine floor. Never hardcode a version into a workflow, doc, or command.
* **Editing any `package.json` — including adding a `workspace:*` dependency — means running
  `pnpm install` and committing `pnpm-lock.yaml` in the same commit.** CI and Railway install with
  `--frozen-lockfile` and fail before compiling anything.
* **`packages/*` resolve at runtime through gitignored `dist/`.** A stale local `dist/` makes code
  pass locally that fails on a clean checkout, so run `rm -rf packages/*/dist` before verifying
  anything you intend to push.

Full rationale in `spec/implementation/00-conventions.md` §2.2, §2.3, and §3.1.

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
