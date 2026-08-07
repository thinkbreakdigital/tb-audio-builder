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

## Builder UI structure

- `src/lib/styles` holds the design tokens and the global sheet. Components use the token variables
  and never introduce raw color literals.
- `src/lib/components` holds presentational primitives (buttons, fields, panel, dialog). They own no
  application state.
- `src/lib/features` holds feature-scoped UI. `features/shell` contains the four workspace regions:
  `ProjectBar`, `ChannelSidebar`, `MainPanel`, and `TransportBar`.
- `src/lib/state` holds the runes state modules, one per concern: `project` (the persisted
  `BuilderProject` and its mutators), `ui` (selection, active view, audio preference), `status`
  (user-visible messages), `playback` (transport readouts), and `sync` (server sync status). State
  modules never touch the DOM, the database, or Web Audio, and never import each other.

Route components call state modules; state modules call client or server services. The solo/mute
resolution rule lives once in `state/project.svelte.ts` as `isChannelAudible`.

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
