# Phase 09 handoff: foundation complete, UI intentionally paused

Phase 09 is split into two explicit milestones:

- **09A — non-rendering instrument foundation:** implemented and independently testable.
- **09B — instrument UI/UX design and wiring:** intentionally paused until the proposed compact
  workflow is manually reviewed and explicitly approved.

This boundary is deliberate. The underlying audio/state contracts can advance without committing
the product to a speculative knob layout, control density, preset browser, or preview interaction.
The next agent must not treat the detailed UI notes as authorization to render them.

## Workspace architecture

The application keeps one top-level `Instrument | Mixer` tab bar.

- **Instrument** follows the selected channel and owns channel name/role/`Include in playback`/
  reset, synthesis settings, instrument presets, and preview.
- **Mixer** is the one global mixer. It owns all channel gain, pan, mute, solo, meters and
  audibility, plus loop, sound sets, normalization, and master controls.

There is no nested `channelTab`, focused channel Mixer, or duplicate channel-mix surface.
`uiState.mainView` remains `'instrument' | 'mixer'`.

## Phase 09A ownership

Phase 09A added these fourteen nonvisual files:

| File                                                                      | Ownership                                                                                                                                                                                                  |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/builder/src/lib/client/audio/engine-client.ts`                      | Sole lazy `AudioEngine` owner; initializes/resumes from gestures, loads current projects, synchronizes a channel instrument, starts preview handles, reports audio failures, and disposes safely.          |
| `apps/builder/src/lib/client/audio/engine-client.test.ts`                 | Concurrency, lifecycle, synchronization, preview, failure, and disposal contract.                                                                                                                          |
| `apps/builder/src/lib/features/instruments/instrument-parameters.ts`      | Authoritative numeric leaf catalog: path, kind, bounds, steps, fine steps, units, decimals, scale, default, integer rule, and optional bank.                                                               |
| `apps/builder/src/lib/features/instruments/instrument-parameters.test.ts` | Numeric-leaf coverage, ranges/defaults, dedicated-versus-banked ownership, and lookup behavior.                                                                                                            |
| `apps/builder/src/lib/features/instruments/parameter-banks.ts`            | Pure metadata for the only approved banks plus `parameterBankOptions(bank, definition)`, which projects values from a matching `InstrumentDefinition` and rejects kind mismatch contextually.              |
| `apps/builder/src/lib/features/instruments/parameter-banks.test.ts`       | Exact bank membership/order, unique keys, prohibited-bank exclusions, matching-definition option projection, and kind-mismatch failure.                                                                    |
| `apps/builder/src/lib/features/instruments/apply-instrument-edit.ts`      | Immutable, range-aware numeric edit helper preserving provenance and untouched branches.                                                                                                                   |
| `apps/builder/src/lib/features/instruments/apply-instrument-edit.test.ts` | Immutability, validation, kind/path mismatch, structural sharing, and contextual errors.                                                                                                                   |
| `apps/builder/src/lib/features/presets/preset-catalog.ts`                 | Fresh schema-valid Factory definitions; UUID User definitions; Factory/User grouping; deterministic search/order and wrapping Previous/Next navigation; provenance/modified detection; factory protection. |
| `apps/builder/src/lib/features/presets/preset-catalog.test.ts`            | Factory count/freshness, custom creation, provenance/modified comparison, deterministic search/navigation, and factory protection.                                                                         |
| `apps/builder/src/lib/features/presets/custom-preset-store.ts`            | Clone-safe, bounded in-memory User preset list/get/Save As/overwrite/delete with normalized names and factory/unknown destructive-operation rejection.                                                     |
| `apps/builder/src/lib/features/presets/custom-preset-store.test.ts`       | Independent Save As records, UUID identity, clone safety, overwrite semantics, and destructive-operation protection.                                                                                       |
| `apps/builder/src/lib/features/presets/sound-set-store.ts`                | Clone-safe, bounded in-memory sound-set CRUD; re-exports project-schema `pairByNameThenPosition`; reuses `planSoundSetApply` and `applySoundSet`; apply preview; pure complete replacement project.        |
| `apps/builder/src/lib/features/presets/sound-set-store.test.ts`           | Immutable saves, separator-insensitive duplicate-name matching, preview accuracy, pure apply, and project/channel identity-boundary preservation.                                                          |

09A also modified two existing nonvisual state files:

| File                                           | Ownership                                                                                                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/builder/src/lib/state/project.svelte.ts` | Adds `replaceProject(next)`: clone the complete input, touch/dirty-mark once, validate once, then install atomically. Invalid input leaves live state unchanged. |
| `apps/builder/src/lib/state/project.test.ts`   | Proves clone isolation, one replacement timestamp/dirty transition, and transactional failure on invalid input.                                                  |

Phase 09A therefore comprises fourteen new files plus two modifications; it is not “fourteen total
changed files.” It owns no Svelte component and makes no `MainPanel`, channel-header, or `uiState`
change.

## Phase 09B omitted work

Do not create or wire these until explicit design approval:

- `ParameterKnob.svelte`, `SegmentedParameterSelector.svelte`, `ParameterBank.svelte`,
  `ControlGroup.svelte`, and their pure interaction/formatting helper tests.
- Pitched/percussion instrument panels and percussion layer presentation.
- Instrument preset header, searchable browser, rendered Factory/User distinction, Save As dialog,
  non-destructive Apply/Cancel audition, and delete/overwrite confirmations. The underlying catalog
  and store behavior already belongs to 09A.
- Press-and-hold preview UI and pointer/keyboard cancellation handling.
- Channel-header role/reset wiring changes and replacement confirmations.
- Sound-set presentation. Sound sets ultimately render in the one global Mixer, not Instrument.

The compact-control proposal remains a review input: O/S/F tuning; A/D/S/R envelopes; Rate/Depth
vibrato; percussion Start/End; dedicated filters, gains, root note, master, and compressor. It is
not a finished layout decision merely because the bank metadata exists.

## Wiring map for the 09B agent

After approval, wire in this order:

1. Build one accessible numeric control primitive using the specs returned by
   `instrument-parameters.ts`. Keep native range semantics and an editable numeric value.
2. Build a semantic radio-group bank selector from `PARAMETER_BANKS`; obtain its option data with
   `parameterBankOptions(bank, matchingInstrumentDefinition)`. Treat a kind-mismatch error as a
   wiring defect. Bank selection is ephemeral and must not call audio, mutate the project,
   autosave, or sync.
3. Read the selected channel from `uiState.selectedChannelId`. Render synthesis controls only in
   top-level Instrument. Never render Gain/Pan/Mute/Solo there.
4. For a numeric live interaction, call `applyInstrumentEdit` on a temporary definition and the
   engine's direct channel-instrument setter. On commit, call one `projectState.updateChannel`, then
   `engineClient.syncChannel`. Cancel restores the committed definition.
5. For structural role/import changes, commit the complete validated project and call
   `engineClient.syncProject()` once. Sound-set Apply wiring is already defined by the completed
   transactional boundary:

   ```ts
   const result = applySoundSetToProject({ project, soundSet });
   projectState.replaceProject(result.project);
   engineClient.syncProject();
   ```

   `replaceProject` clones, touches once, validates once, and changes no live state on invalid
   input. Do not compose `replaceChannels` and `updateMaster`, because that exposes a partial state
   and schedules multiple dirty/autosave operations.

6. Start preview through `engineClient.beginPreview`; release the returned handle on pointer/key
   release, cancel, blur, channel change, role change, and unmount.
7. Build rendered preset search/navigation and Save As on the 09A catalog/stores. Sound-set UI uses
   the store's re-exported project-schema `pairByNameThenPosition`, `planSoundSetApply`-based
   preview, and `applySoundSet`-based result—never a duplicate Builder matcher. Matching is
   trim/case/separator-insensitive, treating runs of whitespace, `_`, and `-` as equivalent.
   Keep browsing/audition temporary until Apply. Preset value changes must not move the currently selected
   parameter-bank member.
8. Leave the global Mixer placeholder for phase 10. Clicking a channel name there will select the
   channel and return to top-level Instrument; it will never open a per-channel mixer.

Audio failure must leave all Instrument editing and later persistence available. Custom preset and
sound-set IDs are UUIDs; factory IDs remain slugs distinguished by `builtIn`.

## Approval and verification

Before 09B implementation begins, review at minimum:

- control density and hierarchy at 1024×640 and 200% zoom;
- O/S/F and A/D/S/R discoverability for a musician;
- keyboard, numeric-entry, focus, reset, and reduced-motion behavior;
- preset Browse/Save As/Apply/Cancel workflow;
- fixed percussion-hit versus MIDI pitch-tracking language;
- clear separation between selected-channel Instrument and the one global Mixer.

After approval and implementation, the repository gate remains `nvm use && pnpm verify` from a
clean package build as documented in `AGENTS.md`.
