# Railway deployment

The production topology contains one Builder application service and one Railway PostgreSQL
service in the same project.

The current production application is available at
<https://tb-audio-builder-production.up.railway.app>. Its database-aware health endpoint is
<https://tb-audio-builder-production.up.railway.app/api/health>.

## One-time setup

1. Create or select a Railway project.
2. Add a PostgreSQL service named `Postgres`.
3. Add an application service connected to the `thinkbreakdigital/tb-audio-builder` repository.
4. Configure these application-service variables:

   ```text
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   NODE_ENV=production
   PUBLIC_APP_NAME=ThinkBreak Web Audio Builder
   PROJECT_TOKEN_SECRET=<cryptographically-random secret with at least 32 bytes>
   ```

5. Generate a Railway-provided domain for the application service.
6. Enable **Wait for CI** on the application service (Settings → Build). This one is not
   expressible in `railway.json`, so it does not survive recreating the service and has to be set
   by hand. Without it Railway builds every push in parallel with GitHub Actions and will happily
   deploy a commit that CI is in the middle of rejecting.

The committed `railway.json` sets `buildCommand: pnpm build:railway`, which is exactly `pnpm
verify` — the same gate CI runs and the same one you run locally, so there is no deploy-only step
list that can drift. It applies Drizzle migrations in the pre-deploy phase, starts the SvelteKit
Node server, and requires `GET /api/health` to succeed before the deployment becomes active.

Railway's builder takes its Node version from `.nvmrc` and its pnpm from the `packageManager`
field, matching CI and local development. Both install with `--frozen-lockfile`: a `pnpm-lock.yaml`
that lags any `package.json` fails the build before anything compiles.

## Deployments

Production should deploy from the connected GitHub repository. Railway reads configuration from
the repository root. A deployment is healthy only when the application can connect to PostgreSQL.

For a deliberate manual deployment from a linked checkout:

```sh
railway up --service tb-audio-builder
```

Inspect deployment logs and confirm the health endpoint after every infrastructure change. Never
put Railway credentials or production variable values in `.env`, `.example.env`, or source files.

## Rollback and migrations

Application deployments can be rolled back in Railway, but database migrations are forward-only.
For breaking schema work, deploy additive changes first, migrate data separately, then remove old
columns in a later deployment. Do not edit a migration that has already run in production.
