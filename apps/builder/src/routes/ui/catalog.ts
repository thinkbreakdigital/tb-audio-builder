/**
 * Reference catalog of the UI elements phases 09B (instrument editor) and 10B (transport + global
 * mixer) need, named the way a mixing board or hardware synth names it. One row per visually
 * distinct element — parts that look the same are merged and their differences listed in
 * `variants`. Data only; the `/ui` page renders it and nothing is wired to project state or audio.
 */

export interface UiElementRow {
	/** Stable id for the placeholder slot the real component is dropped into later. */
	slug: string;
	/** Board-vocabulary name in PascalCase. */
	name: string;
	/** Target file, or the existing component this reuses. */
	file: string;
	instrument: readonly string[];
	mixer: readonly string[];
	transport: readonly string[];
	/** Spec sections the guidance comes from. */
	source: string;
	/** The instruction, or a recommendation where the specs are silent. */
	guidance: string;
	/** Everything this row absorbed: same visual element, different content or behavior. */
	variants?: readonly string[];
}

export interface UiElementGroup {
	id: string;
	title: string;
	rows: readonly UiElementRow[];
}

export const UI_ELEMENT_CATALOG: readonly UiElementGroup[] = [
	{
		id: 'level-and-parameter',
		title: 'Level and parameter controls',
		rows: [
			{
				slug: 'rotary-pot',
				name: 'RotaryPot',
				file: 'components/ParameterKnob.svelte',
				instrument: [
					'Octave / Semitone / Fine tune (banked O/S/F)',
					'Amplitude A/D/S/R (banked)',
					'Pitch bend range',
					'Max voices',
					'Percussion root note',
					'Oscillator layer volume',
					'Pitch decay',
					'Oscillator layer A/D/S/R (banked)',
					'Noise layer volume',
					'Noise layer A/D/S/R (banked)'
				],
				mixer: ['Channel pan', 'Master compressor knee'],
				transport: ['Tempo multiplier'],
				source: '09B §4.2 · 10B §4.4–4.5 · conventions §5.2',
				guidance:
					'One rotary implementation only; a second is a defect. Visually rotary over a native <input type="range"> so the accessibility tree keeps slider semantics. Label above the dial, value + unit text below. No canvas, gradient, shadow, ornamental dial animation, or pointer-only interaction. Vertical drag, Shift for the fine step, arrow / page / home / end keys.',
				variants: [
					'Continuous — the default; free decimals within min/max.',
					'Stepped — integer-only detents for octave, semitone, max voices, root note.',
					'Log-mapped — frequency parameters travel logarithmically while the number field stays linear in Hz. Every log-mapped parameter now lives on DualRotaryPot, but the mapping belongs here and is shared out of pot-interaction.ts.',
					'Readout format changes per parameter, the control does not: plain value + unit, C4 (60) for root note, C / L50 / R30 for pan, effective BPM for tempo.',
					'No reset button. Double-click anywhere on the control body is the only reset path, which buys back the space a button would cost in a strip repeated sixteen times.',
					'The number field is revealed, not resident: a click or Enter swaps the label for it in place, and blur/Escape/Enter restores the label. It stays open while a validation error is showing, so the reason an entry was rejected is never hidden. The reserved label height means opening it never shifts the layout.',
					'Interaction lives in a shared pot-interaction.ts consumed by all three pots, so the rotary, dual, and linear controls cannot drift apart in feel.'
				]
			},
			{
				slug: 'dual-rotary-pot',
				name: 'DualRotaryPot',
				file: 'components/DualParameterKnob.svelte',
				instrument: [
					'Filter cutoff + resonance',
					'Noise layer cutoff + resonance',
					'Vibrato rate + depth',
					'Oscillator start + end frequency'
				],
				mixer: ['Master compressor threshold + ratio', 'Master compressor attack + release'],
				transport: [],
				source: 'Adopted in design; absent from 09B/10B — 09B §4.3 bank list needs amending',
				guidance:
					'Concentric pot in the guitar-pedal idiom: an outer ring and an inner disc sharing one footprint, with a paired label reading OUTER —o— INNER. Only pair parameters of the same family — filter with filter, time with time — because a cross-family pair reads as an accident. Built as two RotaryPot instances composed into one dial, never as a second rotary implementation. Removes about seven dials from the instrument editor and master strip.',
				variants: [
					'Ring thickness is the critical dimension: a thin outer ring is a poor pointer target at 200% zoom, which both phases require.',
					'Two native ranges, two real labels. The two numeric fields are where the space saving partly returns — resolve with one shared value line (1.2kHz / 4.0Q) that expands on focus, or accept the fields side by side.',
					'Retires two approved two-member banks (vibrato Rate/Depth, oscillator Start/End) by showing both values at once instead of one. That edits the exact bank list in 09B §4.3 and is a spec amendment, not an implementation detail.',
					'Ruled out for semitone + fine tune: both already live in the three-way O/S/F bank, and pairing them concentrically would either break that bank or give the same value two controls, which 09B acceptance criterion 2 forbids.',
					'Ruled out for channel volume + pan (conventions §5.2 forbids the pairing and requires a fader), for A/D/S/R (four parameters, any split is arbitrary), and for the two layer volumes (different sections; pairing them would invent a balance control absent from the schema).'
				]
			},
			{
				slug: 'linear-pot',
				name: 'LinearPot',
				file: 'features/mixer/VerticalParameterFader.svelte',
				instrument: [],
				mixer: ['Channel volume fader', 'Master volume'],
				transport: [],
				source: '10B §4.4–4.5 · conventions §5.2',
				guidance:
					'Vertical travel instead of rotation; everything else matches RotaryPot — same revealed number field, double-click reset, keyboard, live/commit, and error behavior. Channel volume is always a fader and is never banked with pan. Design the throw length so a 16-channel rail still fits at 1024×640.',
				variants: [
					'Master volume — 10B §4.5 only says "dedicated" without naming the form. Recommendation: the same fader, so Master reads as a strip.',
					'Labelled Volume everywhere in the UI, because on a board Gain is the input trim and Volume is the fader. The schema keeps mix.gain and master.gain untouched — this is a display name only, and a deliberate deviation from the literal wording of 10B §4.3.'
				]
			},
			{
				slug: 'scrub-slider',
				name: 'ScrubSlider',
				file: 'features/transport/SeekBar.svelte',
				instrument: [],
				mixer: [],
				transport: ['Song position seek'],
				source: '10B §4.1',
				guidance:
					'Horizontal native range that stretches across the transport bar. It is the broad transport variant; Channel Pan uses the same LinearPot primitive in compact horizontal orientation. Needs a visible label, a wide hit target, and a disabled look for the no-song state that does not read as broken.',
				variants: [
					'Scrubbing holds a local draft so poller updates cannot fight the thumb; the thumb must not jump mid-drag.'
				]
			},
			{
				slug: 'segment-switch',
				name: 'SegmentSwitch',
				file: 'components/SegmentedParameterSelector.svelte',
				instrument: [
					'Tuning O / S / F',
					'Pitched amplitude A / D / S / R',
					'Oscillator layer A / D / S / R',
					'Noise layer A / D / S / R',
					'Mono / Poly voice mode'
				],
				mixer: [],
				transport: [],
				source: '09B §4.3 · conventions §5.2',
				guidance:
					"Named native radio group in a <fieldset>, about 1.25rem high, with a sliding or highlighted active segment — the small toggle family, not the large ROI selector. The active parameter's full name stays visible next to it. Reduced motion makes the indicator instant. Selecting a segment only swaps which value the pot edits.",
				variants: [
					'Banked pot — the dominant layout: this switch sits directly above one shared RotaryPot. Design the pair together; there is no separate component for it.',
					'Two-position with full words for Mono / Poly, rather than initials. Recommended over a "Polyphonic" checkbox, which hides the mono state.',
					'Compact initials need hover and focus help carrying the full name.',
					'Vibrato Rate/Depth and oscillator Start/End have moved to DualRotaryPot, which shows both values at once instead of one. What remains here is the three-way O/S/F tuning bank, both four-member A/D/S/R banks, and Mono/Poly — so every surviving bank has three or more members.'
				]
			}
		]
	},
	{
		id: 'switches-and-entry',
		title: 'Switches and entry',
		rows: [
			{
				slug: 'toggle-switch',
				name: 'ToggleSwitch',
				file: 'components/CheckboxField.svelte (exists)',
				instrument: [
					'Filter enabled',
					'Vibrato enabled',
					'Oscillator layer enabled',
					'Noise layer enabled',
					'Oscillator pitch tracking',
					'Noise filter tracking',
					'Include in playback'
				],
				mixer: ['Compressor enabled'],
				transport: ['Loop enabled'],
				source: '09B §4.4 · 10B §4.2',
				guidance:
					'Labelled native checkbox with a compact rectangular selector. Off holds the selector at the grey left stop; on slides it right in the reference selector blue. Disabled sections stay visible and readable so nothing jumps, which means a dimmed-but-legible treatment rather than hiding.',
				variants: [
					'Tracking toggles carry required help text underneath — off: fixed single-hit sound; on: pitch follows incoming MIDI relative to the root note.'
				]
			},
			{
				slug: 'selector-switch',
				name: 'SelectorSwitch',
				file: 'components/SelectField.svelte (exists)',
				instrument: [
					'Pitched waveform',
					'Filter type',
					'Percussion oscillator waveform',
					'Noise layer filter type',
					'Voice steal mode',
					'Channel role'
				],
				mixer: [],
				transport: [],
				source: '09B §4.4',
				guidance:
					'Compact native select, styled for the one- or two-character SVG/glyph labels used by most callers. Keep the option labels and accessible name intact; SegmentSwitch stays reserved for bank selection and Mono/Poly.'
			},
			{
				slug: 'latching-switch',
				name: 'LatchingSwitch',
				file: 'components/IconlessToggleButton.svelte (exists)',
				instrument: [],
				mixer: ['MUTE', 'SOLO'],
				transport: [],
				source: '10B §4.3 · conventions §5',
				guidance:
					'Square S and M buttons carrying aria-pressed. Solo engages yellow and mute red; both states also change weight, fill, and border so they remain clear in grayscale. Sized to sit two-across in a compact strip.'
			},
			{
				slug: 'text-entry',
				name: 'TextEntry',
				file: 'components/TextField.svelte (exists)',
				instrument: ['Channel name', 'Choke group', 'Patch name'],
				mixer: ['Loop start bars.beats', 'Loop end bars.beats', 'Sound set name'],
				transport: [],
				source: '10B §4.2',
				guidance:
					'Reused as delivered. Needs a narrow variant for the bars.beats fields that still shows the full value, and an error state that does not resize the field.'
			},
			{
				slug: 'momentary-button',
				name: 'MomentaryButton',
				file: 'components/Button.svelte (exists)',
				instrument: ['Browse', 'Save As', 'Apply', 'Cancel', 'Reset channel'],
				mixer: [
					'Set loop start from playhead',
					'Set loop end from playhead',
					'Loop whole song',
					'Normalize',
					'Save sound set',
					'Apply sound set',
					'Clip reset'
				],
				transport: ['Return to start', 'Play / Pause', 'Stop', 'Resume audio'],
				source: '09B §4.6 · 10B §4.1 · §4.5',
				guidance:
					'One text button, reused as delivered. Transport buttons are the same button with text labels — no icon fonts, no emoji. The design work is the disabled state: song-dependent controls go inert with no song while project editing stays live, so disabled must read as "not yet" rather than "broken".',
				variants: [
					'Play / Pause is one button that swaps its label, not two.',
					'Default, danger, and disabled treatments.'
				]
			},
			{
				slug: 'step-button',
				name: 'StepButton',
				file: 'features/presets/InstrumentPresetHeader.svelte',
				instrument: ['Previous patch', 'Next patch'],
				mixer: [],
				transport: [],
				source: '09B §4.6',
				guidance:
					'Small square glyph button flanking the patch name. Arrows carry full accessible names plus hover and focus help — an unlabelled arrow is not acceptable on its own.'
			}
		]
	},
	{
		id: 'strips-sections-panels',
		title: 'Strips, sections, and panels',
		rows: [
			{
				slug: 'control-section',
				name: 'ControlSection',
				file: 'components/ControlGroup.svelte · components/Panel.svelte (exists)',
				instrument: [
					'Pitched: Oscillator, Amplitude, Filter, Modulation, Voices',
					'Percussion: Instrument, Oscillator layer, Noise layer',
					'Channel header'
				],
				mixer: ['Loop', 'Master', 'Sound sets'],
				transport: [],
				source: '09B §4.4 · conventions §5',
				guidance:
					'The bordered, titled surface everything else sits inside — Panel is the outer level and ControlGroup the inner one; visually the same treatment at two depths. Flat 1px borders, no shadow. Disabled sections stay in place and keep their values readable. Must wrap legibly at 1024×640 and 200% zoom.'
			},
			{
				slug: 'view-selector',
				name: 'ViewSelector',
				file: 'features/shell/MainPanel.svelte (exists)',
				instrument: ['Instrument tab'],
				mixer: ['Mixer tab'],
				transport: [],
				source: 'conventions §5.3',
				guidance:
					'Exactly two top-level tabs, already built. Listed so the density and weight of the rest of the workspace are designed against it.'
			},
			{
				slug: 'patch-header',
				name: 'PatchHeader',
				file: 'features/presets/InstrumentPresetHeader.svelte',
				instrument: ['Previous · patch name + Modified · Next · Browse · Save As'],
				mixer: [],
				transport: [],
				source: '09B §4.6',
				guidance:
					'One horizontal bar at the top of the instrument editor. Browse and Save As stay visible rather than hiding in a menu, and the name must hold a long patch title without pushing the arrows off the row.',
				variants: [
					'Modified marker sits beside the name as text, not a colored dot — design it inline so the name does not reflow when it appears.'
				]
			},
			{
				slug: 'channel-strip',
				name: 'ChannelStrip',
				file: 'features/mixer/ChannelStrip.svelte',
				instrument: [],
				mixer: [
					'Order: name and type, volume fader, compact horizontal Pan LinearPot, MUTE / SOLO, meter'
				],
				transport: [],
				source: '10B §4.3',
				guidance:
					'The core density decision: one compact column holding six things, repeated up to sixteen times. Channel and Master share one fixed strip height so Master can remain pinned beside the rail. A clickable current-volume dB readout sits above the fader/meter rail and resets a latched clip; it turns red plus gains an explicit marker when clipped. Never exposes role, reset, waveform, envelope, filter, or preset controls. Fix the column width here and everything else follows.',
				variants: [
					'The channel name is itself the navigation control — clicking it selects the channel and opens Instrument, so it needs an interactive affordance while still reading as a title.'
				]
			},
			{
				slug: 'master-strip',
				name: 'MasterStrip',
				file: 'features/mixer/MasterStrip.svelte',
				instrument: [],
				mixer: [
					'Master volume',
					'Compressor enabled (parameters live in the dedicated Compressor pane)',
					'Meter + dB milestones',
					'Clickable current-volume dB readout / clip reset'
				],
				transport: [],
				source: '10B §4.5',
				guidance:
					'A wider strip with the same fixed height as a channel strip, pinned or clearly separated so scrolling channels never slide under it. Its clickable current-volume dB readout resets a latched clip; no separate Reset clip button. The strip only carries the Compressor enabled toggle; threshold, knee, ratio, attack, and release live in the dedicated Compressor pane.'
			},
			{
				slug: 'strip-rail',
				name: 'StripRail',
				file: 'features/mixer/MixerView.svelte',
				instrument: [],
				mixer: ['Horizontally scrollable row of channel strips'],
				transport: [],
				source: '10B §4.3 · conventions §5.3',
				guidance:
					'Horizontal scrolling is the required overflow strategy, not a fallback — so the scroll edge, the labelled region, and the separation from Master are all design decisions. Strips never shrink below usable size to avoid scrolling. Test with sixteen realistic channel names.'
			},
			{
				slug: 'unassigned-list',
				name: 'UnassignedList',
				file: 'features/mixer/MixerView.svelte',
				instrument: [],
				mixer: ['Not included in playback — metadata and ignored channels, name and role only'],
				transport: [],
				source: '10B §4.3',
				guidance:
					'A plain list below the rail. Visually quieter than a strip so it reads as excluded, while still being legible and selectable. No mix controls and no meter.'
			},
			{
				slug: 'advanced-drawer',
				name: 'AdvancedDrawer',
				file: 'features/instruments/InstrumentPanel.svelte',
				instrument: ['Ignored / metadata state'],
				mixer: [],
				transport: [],
				source: '09B §4.1',
				guidance:
					'A labelled disclosure that keeps rarely-touched state out of the sound-design flow without hiding it. Closed by default; the label states what is inside.'
			},
			{
				slug: 'dialog',
				name: 'Dialog',
				file: 'components/ConfirmDialog.svelte (exists) + generic shell',
				instrument: ['Patch browser', 'Patch save', 'Role-change confirmation'],
				mixer: ['Sound-set apply', 'Normalize confirmation'],
				transport: [],
				source: '09B §4.6 · 10B §4.5–4.6',
				guidance:
					'One modal shell: title, body, and a footer action row. Sizes range from a one-line confirmation to a full patch browser, so the body scrolls while the footer stays put. Cancel and Escape always perform zero work.'
			},
			{
				slug: 'patch-browser',
				name: 'PatchBrowser',
				file: 'features/presets/PresetBrowser.svelte',
				instrument: ['Searchable Factory / User preset list'],
				mixer: [],
				transport: [],
				source: '09B §4.6',
				guidance:
					'Dialog body: a search field over a grouped, keyboard-navigable list. Needs a visible selected row, a Factory/User group treatment, and a clear indication that Factory entries cannot be overwritten or deleted. Browsing auditions; only Apply commits.'
			},
			{
				slug: 'sound-set-panel',
				name: 'SoundSetPanel',
				file: 'features/presets/SoundSetPanel.svelte · SoundSetApplyDialog.svelte',
				instrument: [],
				mixer: ['Sound set list, capture description, Save / Apply / Delete'],
				transport: [],
				source: '10B §4.6',
				guidance:
					'Lives only in the global Mixer. Its copy has to state exactly what a sound set captures — channel names, roles, enabled flags, instruments, mix, and master — and nothing else.',
				variants: [
					'Apply dialog shows three columns or stacked lists: assignments, unchanged, discarded. Same list treatment as the panel itself.'
				]
			}
		]
	},
	{
		id: 'meters-indicators-readouts',
		title: 'Meters, indicators, and readouts',
		rows: [
			{
				slug: 'level-meter',
				name: 'LevelMeter',
				file: 'features/mixer/LevelMeter.svelte',
				instrument: [],
				mixer: ['Per-channel meter', 'Master meter'],
				transport: [],
				source: '10B §4.4 · conventions §6',
				guidance:
					'One flat bordered bar with solid stacked zones. No gradient, canvas, or peak animation. Green remains below −12 dB; only the portion above −12 dB is yellow, and only the portion above 0 dB is red. Channel and Master meters show 0, −6, −12, −24, and −48 dB milestones beside the rail. Supplemental and aria-hidden — the strip must be fully readable with the meter ignored, so this is the one element allowed to be purely decorative in the accessibility tree.'
			},
			{
				slug: 'value-readout',
				name: 'ValueReadout',
				file: 'shared mono readout',
				instrument: ['Parameter value + unit', 'Root note as C4 (60)'],
				mixer: ['Pan as C / L50 / R30', 'Resolved loop ticks'],
				transport: ['Position / duration + bars.beats', 'Effective BPM'],
				source: '10B §4.1–4.2 · conventions §5.2 · §6',
				guidance:
					'Mono-font text showing a resolved value. Same element everywhere, only the format differs, so design one type treatment and one alignment rule. Values must not shift the layout as digits change — reserve the width.',
				variants: [
					'Inside pots and faders it sits under the control.',
					'In the transport bar it is the largest instance and reads at a glance.'
				]
			},
			{
				slug: 'field-text',
				name: 'FieldText',
				file: 'shared inline text',
				instrument: ['Tracking help', 'Glyph and bank initial help', 'Numeric validation errors'],
				mixer: ['Sound-set scope statement', 'Loop and numeric validation errors'],
				transport: ['Space shortcut help', 'Tempo and seek validation errors'],
				source: '09B §4.3–4.6 · 10B §4.1–4.2 · conventions §5.2 · §6',
				guidance:
					'Small text attached to a control, linked by aria-describedby. Help and error are the same element with different emphasis — the error variant must be distinguishable in grayscale, not by color alone, and neither may resize its control when it appears.'
			},
			{
				slug: 'engine-status',
				name: 'EngineStatus',
				file: 'features/transport/TransportControls.svelte',
				instrument: ['Retry after audio failure'],
				mixer: [],
				transport: ['Audio context state + Resume button'],
				source: '09B §4.7 · 10B §4.1 · §4.7',
				guidance:
					'A text status paired with a button, sitting at the end of the transport bar. Audio never auto-resumes, so this has to look actionable without looking alarming — editing and saving stay fully available while it is showing.'
			},
			{
				slug: 'status-region',
				name: 'StatusRegion',
				file: 'components/StatusRegion.svelte (exists)',
				instrument: ['Errors and transient status'],
				mixer: ['Errors and transient status'],
				transport: ['Errors and transient status'],
				source: 'conventions §6',
				guidance:
					'One aria-live region for the whole app, already built. Listed because it sits under everything else and its height affects the workspace grid.'
			},
			{
				slug: 'empty-state',
				name: 'EmptyState',
				file: 'components/EmptyState.svelte (exists)',
				instrument: ['No channel selected'],
				mixer: ['No channels'],
				transport: ['No song loaded'],
				source: 'phase 04',
				guidance:
					'Already built. Listed so the empty Mixer and empty Instrument views are designed rather than left as a bare sentence.'
			}
		]
	}
];
