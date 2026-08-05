# Contributing

## Local setup

Use Node.js 22.12 or newer within the Node 22 LTS line and pnpm 10.33.

```sh
cp .example.env .env
pnpm install
pnpm db:start
pnpm db:migrate
pnpm dev
```

Before submitting a change, run:

```sh
pnpm db:check
pnpm check
pnpm lint
pnpm test:unit
pnpm build
```

Keep changes focused, add tests for changed behavior, and update `/spec` when behavior,
architecture, configuration, routes, or product requirements change. Generate and review a new
Drizzle migration whenever the database schema changes.
