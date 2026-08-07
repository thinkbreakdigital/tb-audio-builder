# ThinkBreak Web Audio Builder

An open-source browser application for converting multitrack MIDI compositions into portable Web Audio projects.

Production: <https://tb-audio-builder-production.up.railway.app>

## Development

Requirements:

- Node.js 22.23.2, pinned in `.nvmrc` — run `nvm use`
- pnpm 10.33, pinned in `packageManager` — run `corepack enable`

Install dependencies and start the Builder:

```sh
cp .example.env .env
pnpm install
pnpm dev
```

## Database

Local development uses PostgreSQL with Drizzle ORM. Docker is the simplest supported setup:

```sh
pnpm db:start
pnpm db:migrate
```

The local container listens on port 5433 to avoid colliding with a system PostgreSQL installation.
Set `POSTGRES_PORT` and update `DATABASE_URL` if another port is preferable.

The PostgreSQL container persists data in the `postgres-data` Docker volume. Stop it with
`pnpm db:stop`. The checked-in SQL migrations are the source of truth; after intentionally
changing the Drizzle schema, create and review a migration with `pnpm db:generate`, then apply it
with `pnpm db:migrate`.

With the application running, `GET /api/health` returns HTTP 200 only when PostgreSQL is reachable.
It returns HTTP 503 when the database is unavailable or `DATABASE_URL` is missing.

For Railway, set `DATABASE_URL`, `PROJECT_TOKEN_SECRET`, `NODE_ENV`, and `PUBLIC_APP_NAME` on the
application service. Run `pnpm db:migrate` as the pre-deploy migration command; secrets must never
be committed. See [`docs/deployment.md`](docs/deployment.md) for the complete deployment procedure.

The application is served from `apps/builder`. Shared, framework-neutral code belongs in
`packages/audio-runtime`, and persisted project contracts belong in `packages/project-schema`. See
[`docs/architecture.md`](docs/architecture.md) for the package and persistence boundaries.
See [`docs/midi-support.md`](docs/midi-support.md) for supported MIDI events, warnings, and role
suggestions.

## Checks

```sh
pnpm check
pnpm lint
pnpm test:unit
pnpm build
```

See [`spec/ProjectKickoff.md`](spec/ProjectKickoff.md) for the product requirements and phased
implementation plan.
