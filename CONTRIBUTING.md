# Contributing

## Local setup

Use Node.js 22.22.2 or newer within the Node 22 LTS line (`.nvmrc` pins 22.23.2) and pnpm 10.33.

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
pnpm build:packages
pnpm check
pnpm lint
pnpm test:unit
pnpm build
```

Keep changes focused, add tests for changed behavior, and update `/spec` when behavior,
architecture, configuration, routes, or product requirements change. Generate and review a new
Drizzle migration whenever the database schema changes.
