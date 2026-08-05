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

The committed `railway.json` runs type checks, unit tests, and the production build. It applies
Drizzle migrations in the pre-deploy phase, starts the SvelteKit Node server, and requires
`GET /api/health` to succeed before the deployment becomes active.

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
