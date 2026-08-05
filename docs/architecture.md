# Architecture

ThinkBreak Web Audio Builder is a pnpm workspace with one SvelteKit application and shared,
framework-neutral packages.

## Boundaries

- `apps/builder` owns the SvelteKit UI, server routes, and server-only infrastructure.
- `packages/project-schema` owns versioned persisted data contracts and migrations between project
  document versions.
- `packages/audio-runtime` owns browser audio behavior shared by Builder preview and generated
  exports.
- `apps/builder/src/lib/server/database` is the only place that creates database connections or
  defines database tables.
- Future HTTP routes call repository and service modules; UI route components must not query the
  database directly.

Database credentials are read through SvelteKit's private server environment and cannot be
imported into browser code. PostgreSQL stores durable project documents and source files, while
IndexedDB will remain the immediate local-first persistence layer.

## Runtime flow

```text
Browser UI -> local project state -> IndexedDB
                                -> synchronization API
                                   -> service/repository boundary
                                      -> Drizzle -> PostgreSQL
```

The synchronization API will use expected revision numbers so stale clients cannot overwrite a
newer server project. Raw access tokens are never stored in PostgreSQL.

## Schema changes

Edit the Drizzle schema, run `pnpm db:generate`, review the generated SQL, and commit the schema and
migration together. Existing migration files are immutable after they have reached a shared or
production environment.
