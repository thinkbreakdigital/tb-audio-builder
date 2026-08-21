# Modular sizing grid handoff: individual controls done, mixer strips left

Wave 0 (tokens and spec) and Wave 1 (every individual control) are done and verified. Wave 2 (the
composed mixer and instrument surfaces) has not started. This document gives you what you need to
finish it without re-reading the whole implementation conversation.

## Goal

Every control in the Builder used to pick its own size. An 84px rotary pot sat beside a 112px
concentric pot beside a 116px mixer strip, with flex gaps between them, so no row of controls
summed to a predictable width. Two symptoms: the Filter and Modulation columns in
`InstrumentChannelMockup.svelte` declared `flex: 0 0 184px` but held about 198px and 218px of
content, so both overflowed their own container; and `--mixer-level-rail-height: 144px` sat in
`tokens.css` unused, because the mixer strip handed its fader and meter `height="100%"` and let
them take whatever pixels were left over.

This work replaces free-form sizing with a modular grid: an 8px base unit, module widths in
multiples of 32px, height bands of 32px, and padding baked into each module so runs of modules
butt together with `gap: 0` and no leftover pixels. The full normative rule is
`spec/implementation/00-conventions.md` §5.4, "Modular sizing grid". Read that section before
touching any file below. It is the single source of the widths, bands, and padding scale, and this
document does not repeat it.

`spec/` is gitignored. It exists on this machine but will not show in `git status` or a diff.
Note any spec change you make in your commit message, since that message is the only trace of it
that survives a clone.

## What's done

### Tokens and spec

`apps/builder/src/lib/styles/tokens.css` has the full modular grid: `--u`, `--mod-1` through
`--mod-16`, `--band-1` through `--band-12`, the padding scale (`--pad-1/2/3`), and per-family size
tokens (`--dial-size`, `--fader-track`, `--meter-width`, and so on). `--control-height` is now
32px, `--mixer-level-rail-height` is now 224px, and `--space-3` (12px, not a multiple of 8) is
deleted.

Five spec files were updated to match: `00-conventions.md` (new §5.4, two new entries in §13
Deliberate deviations, `--control-height` corrected to 32px in §5), `04-app-shell.md` §4.2 (shell
grid now 64/256/64), `09b-instrument-editor-ui.md` §4.3 (segment track now a hard 24px),
`ProjectKickoff.md` §5.1 (product-level paragraph pointing at §5.4), and
`InstrumentChannelMockupAdjustment.md` (segment-width reference corrected). `catalog.ts`'s
guidance strings were also corrected to match the new figures.

### Individual controls (Wave 1)

Every control file in `routes/ui/elements/`, every file in `lib/components/`, the app shell grid
in `routes/+page.svelte`, and every file in `lib/features/{shell,channels,midi-import}/` are done.
All of it is on the modular grid, and `pnpm check` passes clean across the whole workspace: 894
files, 0 errors, 0 warnings. Read the comments in a component's `<style>` block for the arithmetic
that sizes it; a few worth reading first as worked examples:

| File | Footprint | Worked example for |
| --- | --- | --- |
| `routes/ui/elements/RotaryPot.svelte` | 64×96 (compact 64×64) | out-of-flow error, dial sizing |
| `routes/ui/elements/DualRotaryPot.svelte` | 96×96 | concentric dial, redrawn glyph |
| `routes/ui/elements/LinearPot.svelte` | 64×160 specimen; takes an explicit `shaftHeight` in a strip | fader/thumb tokens |
| `routes/ui/elements/ToggleSwitch.svelte`, `LatchingSwitch.svelte`, `ViewSelector.svelte` | 64×64, 64×32, tabs at 64 wide | butted-seam rule: the second module drops its inline-start border and adds 1px of padding there |
| `routes/ui/elements/SegmentSwitch.svelte` | 64×64 (3 segments), 96×64 (4 segments or 2 words) | self-sizing from segment count |
| `routes/ui/elements/ControlSection.svelte` | fluid width, 128px (4 bands) | container slack (see below) |
| `routes/+page.svelte` (app shell grid) | 64/256/64 bars and sidebar | confirmed: body is exactly 512px (16 bands) and the main panel exactly 768px (24 modules) at 1024×640 |

One rule came out of this work that isn't obvious from reading §5.4's examples alone. Containers
may carry slack, modules may not. A module's footprint is exact. A container that holds modules
rounds up to the next module or band and absorbs the remainder itself, with its children
start-aligned in a `1fr` track. `ControlSection.svelte` is the worked example: it is 4 bands
(128px) holding a 96px control row, with `align-items: start` on `.controls` and the leftover 6px
sitting in the container's own padding, not invented as an off-scale value on the control row
itself. Read this rule before sizing any of the Wave 2 files below, since every one of them is a
container holding modules.

**One known gap, not yet fixed.** `ValueReadout.svelte`'s `format-note` box is `--mod-2` (64px),
sized for an 8-character string, but `formatNote()` can produce a 9-character string: a sharp note
at a double-digit octave, for example `F#9 (126)`. At `--font-size-base` monospace that string is
roughly 76px, wider than its 64px box. Nobody has checked this in a browser yet. Widen the box to
`--mod-3` (96px) or shorten the format before treating this file as finished.

## What's left: Wave 2, the composed surfaces

Five files, none started, listed in dependency order because each one is a sum of the Wave 1
footprints above:

1. `routes/ui/elements/ChannelStrip.svelte`
2. `routes/ui/elements/MasterStrip.svelte`
3. `routes/ui/elements/StripRail.svelte`
4. `routes/ui/elements/InstrumentChannelMockup.svelte`
5. `routes/ui/+page.svelte`, the catalog page's cell geometry only: `.slot-box`, `.slot-head`,
   `.name-head`, the table's `min-width`, `.instrument-preview`

### ChannelStrip and MasterStrip

Target: `ChannelStrip` 128×384 (`var(--mod-4)` × `var(--mixer-strip-height)`), `MasterStrip`
160×384 (`var(--mod-5)` × `var(--mixer-strip-height)`).

Give both strips this band stack, so the channel and master faders start at the same offset and
line up:

| Band run | ChannelStrip | MasterStrip |
| --- | --- | --- |
| Border + top padding | 8px | 8px |
| Header | channel name 24px + role badge 24px = 48px | "MASTER" title + rule, one 48px row |
| dB readout | 32px | 32px |
| **Fader/meter rail** | **224px, starting at 88px** | **224px, starting at 88px** |
| Trailing controls | Pan 32px + Mute/Solo 32px | Compressor toggle 64px |
| Bottom padding + border | 8px | 8px |
| **Total** | **384px** | **384px** |

Both rails start at 88px and both are 224px, so the fader and meter tops line up when a
`MasterStrip` sits beside a `StripRail`. Pass `var(--mixer-level-rail-height)` to `LinearPot`'s
`shaftHeight` and `LevelMeter`'s `height` explicitly. Delete both `height="100%"` and
`shaftHeight="100%"` call sites. That is what revives the `--mixer-level-rail-height` token, which
was declared and unused before this work started.

`gap: var(--space-2)` on both strip grids and on `.level-rail` becomes `gap: 0`. Give each row its
own padding instead, per the container-slack rule above.

One decision is still open. `MasterStrip` currently has a 2px border
(`border: 2px solid var(--color-border-strong)`) against `ChannelStrip`'s 1px. With the header now
occupying a fixed 48px band in both strips, keeping the 2px border pushes the master rail's content
box start one pixel later than the channel rail's, which defeats the point of matching header
heights. Two ways to resolve it:

- Drop `MasterStrip` to a 1px border, matching `ChannelStrip` and the flat-surfaces rule in
  `00-conventions.md` §5. Master keeps its visual weight from `--color-surface` against
  `ChannelStrip`'s `--color-background`, which is already how the two are distinguished.
- Keep the 2px border and accept a 1px rail misalignment.

Take the first option unless you have a reason not to. If you take the second, say so in your
report and show the arithmetic that makes the 1px offset acceptable.

### StripRail

Target width `min(100%, var(--mod-16))` = 512px, which is exactly four butted `ChannelStrip`
instances (`4 × 128px`). Drop `.rail`'s `padding: var(--space-2)` and `gap: var(--space-2)`.
Strips must touch the container edge and each other, per the butt rule in §5.4.

### InstrumentChannelMockup

Target column width: `flex: 0 0 var(--mod-7)` = 224px, `gap: 0` between columns. This is the fix
for the overflow bug described in the Goal section above. Verify these two sums by hand once you've
finished the Wave 1 dependencies:

- Filter column: `ToggleSwitch` 64 + `SelectorSwitch` 64 + `DualRotaryPot` 96 = 224, exact.
- Modulation column: `ToggleSwitch` 64 + `DualRotaryPot` 96 + `RotaryPot` compact 64 = 224, exact.

If either sum comes out different from what's above, one of the Wave 1 footprints changed
underneath you: a footprint changed size, or a variant you're using isn't the one documented in
the table above. Stop and check the component file's own comments before adjusting the column
width to fit. Each `.control-row` becomes 3 bands (96px) tall with `align-items: start`, since
`DualRotaryPot` is the tallest control at 96px and the row must not stretch shorter controls to
match it.

### Catalog page cell geometry

`routes/ui/+page.svelte`'s `.slot-box` is currently sized to the old specimen dimensions
(`min-width: 120px; min-height: 96px`). Per §5.4, the production strip and panel are the sizing
authority, not this catalog cell. Resize the cell to fit the components once Wave 2's strips are
final, not the other way round. Update `.slot-head`, `.name-head`, the table's `min-width`, and
`.instrument-preview`'s `min-width` to match the new strip and column widths.

## Verification

Do these in order:

1. `nvm use` (Node 22.23.2, pinned by `.nvmrc`).
2. `pnpm check` and `pnpm lint` after each file, same as Wave 1.
3. After all five Wave 2 files are done, `rm -rf packages/*/dist` and run `pnpm verify` once from
   the repo root. Nobody has run it across the full change yet, so this is the first full run. It
   is the only gate; do not run `check`, `lint`, `test:unit`, or `build` individually as a
   substitute.
4. No browser automation of any kind, not even ad hoc. `AGENTS.md` bans it outright. Verify by
   reading the component code and the token values, then start `pnpm dev` and ask a human to look
   at `/ui`.

What to ask a human to check on `/ui`, in order of how likely each is to be wrong:

1. Filter and Modulation columns: no horizontal overflow, the `DualRotaryPot`'s right edge meets
   the column's own padding with nothing clipped. These are the two columns that overflow today.
2. `MasterStrip` beside `StripRail`: fader tops and meter tops line up across every strip.
3. Section and strip seams: a single 1px line between butted modules, never a doubled 2px line and
   never a visible gap.
4. Both strips measure exactly 384px tall with no scrollbar and no clipped row.
5. Shell: at exactly 1024×640, the body between the bars is 512px and the main panel is 768px. At
   899px wide, the sidebar stacks into a 192px row.

## Constraints

- Model routing per `AGENTS.md`: this is CSS and component work, so run it on Sonnet.
- `StripRail.svelte`, `InstrumentChannelMockup.svelte`, and `routes/ui/+page.svelte` each depend
  on the strips' final numbers, so do `ChannelStrip.svelte` and `MasterStrip.svelte` first.
- No raw pixel literals for size where a token exists.
- Sizing only. Do not touch component behavior, prop names, events, aria attributes, or keyboard
  handling, in any file, at any wave.
- Solo-developer repo, main branch, no PR review. Do not create a new branch unless told to.
