# Phase 10 handoff: headless foundation complete, rendered UI paused

Phase 10 is split at the rendering boundary:

- **10A — headless transport/global-Mixer foundation:** implemented and verified; specification in
  `spec/implementation/10-transport-mixer-ui.md`.
- **10B — transport/global-Mixer UI/UX:** intentionally paused plan in
  `spec/implementation/10b-transport-mixer-ui.md`.

No rendered transport or Mixer work is authorized until 09B and 10B are reviewed together and the
user explicitly approves the UI direction.

## Fixed architecture

The workspace has one top-level `Instrument | Mixer` switch.

- Instrument follows the selected channel and is rendered by 09B.
- Mixer is one global all-channel surface rendered by 10B. It owns every channel Volume/Pan/Mute/
  Solo/meter plus loop, sound sets, normalization, and Master.

There is no focused/per-channel Mixer, nested `channelTab`, or duplicate channel-mix UI.

## 10A ownership

10A owns only non-rendering code and tests:

- playback state plus a single lifecycle-bounded poller;
- visibility handling that stops UI work without pausing background audio;
- time formatting plus bars/beats loop parsing/validation;
- transport actions with gesture initialization and live/commit separation;
- channel mix actions and canonical audibility;
- master actions and pure normalization planning/application;
- sound-set Apply orchestration through the delivered 09A transaction.

The delivered file manifest and exact acceptance criteria are in the 10A spec. No rendered `.svelte`
component, `MainPanel`, `TransportBar`, or shell layout belongs to 10A; the runes state module
`playback.svelte.ts` is non-rendering and is allowed.

Key lifecycle contract: `createPlaybackPoller(...)` receives injected engine, playback-state,
animation-frame, visibility, reduced-motion, and monotonic-time readers. It returns `start()`,
`stop()`, `sampleNow()`, `setMeterTargets(channelIds, includeMaster)`, `setVisible(visible)`,
`isRunning`, and `dispose()`. The future layout owns one instance; replacing meter targets
immediately clears stale levels. There is no module-global timer.

It runs one rAF while playing/visible even when no meters are targeted, samples position atomically,
and reads analyzers only for declared targets at 20Hz (5Hz through an injected reduced-motion
dependency). Empty targets stop analyzer reads, not transport sampling.

Channel actions are the sole future Mixer path:

```ts
setChannelGain(channelId: string, value: number, mode: 'live' | 'commit'): boolean;
setChannelPan(channelId: string, value: number, mode: 'live' | 'commit'): boolean;
setChannelMuted(channelId: string, value: boolean): boolean;
setChannelSoloed(channelId: string, value: boolean): boolean;
```

Live continuous actions conditionally mirror to initialized audio. Commit always updates validated
project state once—even when audio is uninitialized/failed—then conditionally mirrors to audio.
Engine failure reports context without rolling back the edit. Svelte components must not recreate
this behavior. A successful commit returns `true` even without audio; a live-only action returns
`false` when there is no initialized engine to preview the change.

Invalid, reversed, out-of-range, and degenerate loop input causes no project or engine mutation.
Only explicit commands such as `Loop whole song` construct a replacement range; user-entered values
are never silently repaired by clamping.

Sound-set orchestration is fixed:

```ts
const result = applySoundSetToProject({ project, soundSet });
projectState.replaceProject(result.project);
engineClient.syncProject();
```

Matching/planning/apply remain owned by project-schema through the 09A adapter. Neither 10A nor 10B
may compose `replaceChannels`/`updateMaster` or duplicate matching.

## Delivered code map

- `state/playback.svelte.ts` plus `playback.test.ts`: atomic snapshots, duration ticks, errors,
  channel/master levels, master clip latch/reset, and complete engine-owned reset.
- `client/audio/playback-poller.ts` and `visibility.ts` plus tests: one bounded frame lifecycle,
  20Hz/5Hz target-only metering, explicit browser adapters, and teardown/error handling.
- `features/transport/format-time.ts`, `loop-region.ts`, and `transport-actions.ts` plus tests:
  `m:ss.mmm`, algebraic bars/beats across signature boundaries, strict loops, and one-call
  transport/poller orchestration.
- `features/mixer/channel-mix-actions.ts` and `mixer-audibility.ts` plus tests: channel/master
  live-versus-commit actions, exhaustive audibility, pure `planChannelGainNormalization`,
  snapshot-based normalization commit, and confirmed sound-set replacement.
- `client/audio/engine-client.ts` now resets all playback/meter state when engine ownership ends.

Phase 10A added fifteen non-rendering files and modified the engine client, its test, and playback
state. The clean repository `pnpm verify` gate passed with 245 audio-runtime, 41 project-schema, 30
MIDI-parser, and 112 Builder tests.

One runtime optimization remains intentionally visible for the next backend touch: the public
engine exposes separate loop-region and loop-enabled setters. A combined change therefore uses two
guarded runtime calls after one project transaction and can rebase active playback twice. Before
10B wires a gesture that changes both simultaneously, add one atomic runtime loop setter. Region-
only and enable-only changes already use one call, and invalid input performs no project/audio work.

## 10B omitted work

10B will render, after joint approval:

- transport controls, readouts, horizontal seek, loop fields, Tempo, and Resume audio;
- horizontally scrollable compact channel strips with vertical Volume fader, Pan knob, text MUTE/
  SOLO, supplemental meter, and audibility text;
- a clearly separated Master with a dedicated Volume fader, concentric `DualParameterKnob`
  compressor Threshold+Ratio and Attack+Release, a dedicated Knee knob, and CLIP reset;
- explicit Normalize confirmation and SoundSetPanel/Apply preview;
- shell lifecycle installation, target registration, keyboard shortcut filtering, accessibility,
  reduced motion, 1024×640, and 200% zoom behavior.

10B consumes 10A action/state contracts and approved 09B numeric primitives. It owns no formulas,
matching, state transactions, poller timers, or audio lifecycle logic.

## Wiring map for the future 10B agent

1. Render the existing top-level Mixer tab only; never add another tab level.
2. Install the 10A visibility/poller lifecycle once and tear it down once.
3. Register only rendered channel meter IDs; components own no timer.
4. Bind transport/channel/master controls to 10A actions, keeping scrubbing/numeric drafts local.
5. Keep Volume as a vertical fader and Pan as a dedicated knob; do not create a Volume/Pan bank or
   pair.
6. Render audibility text independently of decorative meters.
7. Use 10A normalization and sound-set actions after explicit confirmation; Cancel performs zero
   work.
8. Clicking a channel name selects it and switches to top-level Instrument with zero persisted or
   audio change.

## Approval checklist

Review 09B and 10B together for control density, hierarchy, consistent primitives, musician
language, keyboard/numeric access, focus, reduced motion, realistic 16-channel overflow, minimum
1024×640 layout, and 200% zoom. After approved implementation, run the repository's complete
`nvm use && pnpm verify` gate.
