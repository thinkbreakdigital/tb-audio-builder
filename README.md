# ThinkBreak Web Audio Builder

An open-source browser application for converting multitrack MIDI compositions into portable Web Audio projects.

## Development

Requirements:

- Node.js 20.19 or newer
- pnpm 10

Install dependencies and start the Builder:

```sh
pnpm install
pnpm dev
```

The application is served from `apps/builder`. Shared, framework-neutral code belongs in `packages/audio-runtime`, and persisted project contracts belong in `packages/project-schema`.

## Checks

```sh
pnpm check
pnpm lint
pnpm test:unit
pnpm build
```

See `ProjectKickoff.md` for the product requirements and phased implementation plan.
