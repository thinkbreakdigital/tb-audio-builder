# Contributing

## Local setup

`.nvmrc` pins the Node version — 22.23.2 — and it is the single source of truth: CI reads it via
`node-version-file`, and Railway's builder reads it too. Run `nvm use` before anything else so your
shell matches. pnpm comes from `packageManager` in the root `package.json`; run `corepack enable`
once and it will match automatically.

```sh
cp .example.env .env
pnpm install
pnpm build:packages
pnpm db:start
pnpm db:migrate
pnpm dev
```

The workspace packages under `packages/` resolve through their compiled `dist/`, which is not
committed, so `pnpm build:packages` has to run once after cloning and again whenever their sources
change. Anything that imports them at runtime — `pnpm test:unit` in particular — fails to resolve
them otherwise.

Before submitting a change, run:

```sh
pnpm db:check
pnpm verify
```

`pnpm verify` is the whole gate — lockfile integrity, package build, type check, lint, unit tests,
app build — and it is the same command CI runs and the same command Railway runs as its build. If it
passes locally on the pinned Node, CI and the deploy agree. Do not reproduce its steps by hand in one
place and not the others; change `verify` instead.

If you edit any `package.json`, run `pnpm install` and commit the resulting `pnpm-lock.yaml` in the
same commit. CI and Railway both install with `--frozen-lockfile`, so a lockfile that lags behind a
manifest fails the build before a single line is compiled.

Keep changes focused, add tests for changed behavior, and update `/spec` when behavior,
architecture, configuration, routes, or product requirements change. Generate and review a new
Drizzle migration whenever the database schema changes.
