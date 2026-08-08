/**
 * Reference catalog of every individual UI element phases 09B (instrument editor) and 10B
 * (transport + global mixer) need, named the way a mixing board or hardware synth names it.
 * Data only — the `/ui` page renders it and nothing is wired to project state or audio.
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
					'Vibrato Rate / Depth (banked)',
					'Filter cutoff',
					'Filter resonance',
					'Pitch bend range',
					'Max voices',
					'Percussion root note (stepped)',
					'Oscillator layer gain',
					'Oscillator start / end frequency (banked)',
					'Pitch decay',
					'Oscillator layer A/D/S/R (banked)',
					'Noise layer cutoff',
					'Noise layer resonance',
					'Noise layer gain',
					'Noise layer A/D/S/R (banked)'
				],
				mixer: [
					'Channel pan (dedicated, never banked)',
					'Master compressor threshold',
					'Master compressor knee',
					'Master compressor ratio',
					'Master compressor attack',
					'Master compressor release'
				],
				transport: ['Tempo multiplier (dedicated, never banked)'],
				source: '09B §4.2 · 10B §4.4–4.5 · conventions §5.2',
				guidance:
					'One rotary implementation only; a second is a defect. Visually rotary over a native <input type="range"> so the accessibility tree keeps slider semantics. Real label, editable number input below, visible value/unit text, labelled reset. Vertical pointer drag, Shift uses fineStep, Arrow / Shift+Arrow / PageUp / PageDown / Home / End, double-click reset, pointer cancellation restores the last commit. Log position mapping for Hz parameters while the number field stays linear. onlive touches audio only; oncommit writes the project once. No canvas, gradient, shadow, ornamental animation, or pointer-only interaction.'
			},
			{
				slug: 'linear-pot',
				name: 'LinearPot',
				file: 'features/mixer/VerticalParameterFader.svelte',
				instrument: [],
				mixer: ['Channel gain fader', 'Master gain'],
				transport: [],
				source: '10B §4.4–4.5 · conventions §5.2',
				guidance:
					'Native vertical range plus editable number and reset, sharing RotaryPot parsing, formatting, live/commit, keyboard, and error behavior. Channel gain stays a fader and is never banked with pan. Open point: 10B §4.5 calls master gain "dedicated" without naming the form — recommendation is LinearPot so the master region reads as a strip.'
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
					'Labelled horizontal native range. Scrubbing holds a local draft so poller updates cannot fight the thumb; change commits, cancel restores the engine position. Seeking never starts audio. Disabled with no song loaded, without disabling project editing.'
			},
			{
				slug: 'bank-switch',
				name: 'BankSwitch',
				file: 'components/SegmentedParameterSelector.svelte',
				instrument: [
					'Tuning O / S / F',
					'Pitched amplitude A / D / S / R',
					'Vibrato Rate / Depth',
					'Oscillator layer A / D / S / R',
					'Noise layer A / D / S / R',
					'Oscillator Start / End frequency'
				],
				mixer: [],
				transport: [],
				source: '09B §4.3 · conventions §5.2',
				guidance:
					"Named native radio group inside a <fieldset>. Compact sliding/highlighted active segment about 1.25rem high — the small toggle family, not the large ROI selector. Every initial carries a full accessible name plus hover/focus help, and the active parameter's complete name stays visible. Reduced motion makes the indicator instant. Selecting a member swaps spec and value only and performs zero audio, project, autosave, or sync work; the selection is never persisted, synced, or exported."
			},
			{
				slug: 'banked-pot',
				name: 'BankedPot',
				file: 'components/ParameterBank.svelte',
				instrument: ['The six PARAMETER_BANKS entries only'],
				mixer: [],
				transport: [],
				source: '09B §4.3 · conventions §5.2',
				guidance:
					'BankSwitch plus one shared RotaryPot. Reads options through parameterBankOptions(bank, definition); a kind mismatch is a wiring defect, not a runtime fallback. Do not bank filters, channel gain/pan, layer gains, root note, pitch decay, bend range, voice controls, master, compressor, tempo, or unrelated units.'
			},
			{
				slug: 'value-entry',
				name: 'ValueEntry',
				file: 'part of ParameterKnob / VerticalParameterFader',
				instrument: ['Every pot’s number field'],
				mixer: ['Gain, pan, and compressor number fields'],
				transport: ['Tempo number field'],
				source: 'conventions §5.2 · §6',
				guidance:
					'Free typing, commits on change or Enter. Empty, malformed, non-finite, and out-of-range values show a linked error and leave the committed value unchanged; Escape restores it. Every value is editable without touching a slider.'
			},
			{
				slug: 'recall-default',
				name: 'RecallDefault',
				file: 'part of ParameterKnob / VerticalParameterFader',
				instrument: ['Every pot'],
				mixer: ['Every pot and fader'],
				transport: ['Tempo'],
				source: 'conventions §5.2',
				guidance:
					'Labelled reset button restoring the parameter default. Never icon-only. Double-click on the control is an additional path to the same action, never the only one.'
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
					'Include in playback (channel header)'
				],
				mixer: ['Compressor enabled'],
				transport: ['Loop enabled'],
				source: '10B §4.2 · conventions §5',
				guidance:
					'Reuse as delivered. Labelled native checkbox bound by for/id. Disabled sections stay visible rather than unmounting, so toggling one never jumps the layout.'
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
					'Channel role (channel header)'
				],
				mixer: [],
				transport: [],
				source: '09B §4.4',
				guidance:
					'Recommendation: reuse the native select rather than adding a second segmented family — BankSwitch is reserved for bank selection. These are all "direct" controls in 09B §4.4, reachable without a bank.'
			},
			{
				slug: 'mode-switch',
				name: 'ModeSwitch',
				file: 'components/ModeSwitch.svelte',
				instrument: ['Mono / Poly voice mode'],
				mixer: [],
				transport: [],
				source: '09B §4.4',
				guidance:
					'Recommendation: a two-position named radio group showing both words, built on the BankSwitch shell but with full labels instead of initials. A checkbox labelled "Polyphonic" is rejected because it hides the mono state behind an unchecked box.'
			},
			{
				slug: 'tracking-switch',
				name: 'TrackingSwitch',
				file: 'components/TrackingSwitch.svelte',
				instrument: ['Oscillator layer pitchTracksNote', 'Noise layer filterTracksNote'],
				mixer: [],
				transport: [],
				source: '09B §4.4',
				guidance:
					'ToggleSwitch plus mandatory contextual help. Off states the channel is a fixed single-hit sound. On states pitch follows incoming MIDI relative to the root note.'
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
					'Text toggles carrying aria-pressed. The word MUTE or SOLO in an active style is the state; color alone never communicates it.'
			},
			{
				slug: 'text-entry',
				name: 'TextEntry',
				file: 'components/TextField.svelte (exists)',
				instrument: ['Channel name', 'Choke group', 'Patch name (save dialog)'],
				mixer: ['Loop start bars.beats', 'Loop end bars.beats', 'Sound set name'],
				transport: [],
				source: '10B §4.2',
				guidance:
					'Reuse as delivered. Loop fields render the 10A validation message and mutate nothing while the text is invalid.'
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
					'CLIP reset'
				],
				transport: ['Resume audio'],
				source: '09B §4.6 · 10B §4.1–4.6',
				guidance:
					'Reuse as delivered. Destructive and project-wide actions (normalize, sound-set apply, role change) route through a confirmation that states what will change.'
			},
			{
				slug: 'transport-button',
				name: 'TransportButton',
				file: 'features/transport/TransportControls.svelte',
				instrument: [],
				mixer: [],
				transport: ['Return to start', 'Play / Pause', 'Stop'],
				source: '10B §4.1',
				guidance:
					'Song-dependent controls disable with no song loaded without disabling project editing. Space toggles Play/Pause except when focus is in an input, select, textarea, button, contenteditable, or dialog; visible help states the shortcut. Text labels, no icon fonts or emoji.'
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
					'Arrow glyphs require full accessible names and hover/focus help; ambiguous icon-only actions are prohibited. Stepping auditions but never moves bank selection.'
			},
			{
				slug: 'audition-pad',
				name: 'AuditionPad',
				file: 'features/instruments/InstrumentPanel.svelte',
				instrument: ['Press-and-hold preview — pitched MIDI 60, percussion 36'],
				mixer: [],
				transport: [],
				source: '09B §4.7',
				guidance:
					'Press-and-hold through engineClient.beginPreview. Pointer release, key release, pointer cancel, lost capture, blur, selection change, role change, dialog close, and unmount each release the handle exactly once. Audio failure leaves all editing enabled and shows a gesture-driven retry.'
			},
			{
				slug: 'channel-select-button',
				name: 'ChannelSelectButton',
				file: 'features/mixer/ChannelStrip.svelte',
				instrument: [],
				mixer: ['Strip name — selects the channel and opens Instrument'],
				transport: [],
				source: '10B §4.3 · conventions §5.3',
				guidance:
					'Clicking the name selects the channel, switches the top-level view to Instrument, and focuses its heading. This performs zero project, audio, autosave, or sync work.'
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
				file: 'components/ControlGroup.svelte',
				instrument: [
					'Pitched: Oscillator, Amplitude, Filter, Modulation, Voices',
					'Percussion: Instrument, Oscillator layer, Noise layer'
				],
				mixer: ['Loop', 'Master', 'Sound sets'],
				transport: [],
				source: '09B §4.4',
				guidance:
					'Labelled fieldset-style section. Disabled sections remain visible so the layout never jumps. The whole layout must wrap legibly at 1024×640 and at 200% zoom.'
			},
			{
				slug: 'panel',
				name: 'Panel',
				file: 'components/Panel.svelte (exists)',
				instrument: ['Channel header', 'Instrument body'],
				mixer: ['Mixer regions'],
				transport: [],
				source: 'phase 04',
				guidance: 'Reuse as delivered. Flat surface separated by a 1px border.'
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
					'Exactly two top-level tabs. Semantic, keyboard-operable, and ephemeral. No nested channelTab and no second mixer surface.'
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
					'Browse and Save As are visible actions, not hidden in a menu. Preset changes never move bank selection.'
			},
			{
				slug: 'channel-strip',
				name: 'ChannelStrip',
				file: 'features/mixer/ChannelStrip.svelte',
				instrument: [],
				mixer: [
					'Order: name and type, LinearPot gain, Pan RotaryPot, MUTE/SOLO, LevelMeter, SignalStatus'
				],
				transport: [],
				source: '10B §4.3',
				guidance:
					'Compact vertical strip for played channels only. Never exposes role, reset, waveform, envelope, filter, or instrument preset controls — those belong to Instrument.'
			},
			{
				slug: 'master-strip',
				name: 'MasterStrip',
				file: 'features/mixer/MasterStrip.svelte',
				instrument: [],
				mixer: [
					'Master gain',
					'Compressor Enabled + Threshold / Knee / Ratio / Attack / Release',
					'LevelMeter',
					'CLIP reset'
				],
				transport: [],
				source: '10B §4.5',
				guidance:
					'Pinned or clearly separated from the strip rail; overflow must never overlap it. None of its parameters is banked. Disabled compressor values stay visible and readable.'
			},
			{
				slug: 'strip-rail',
				name: 'StripRail',
				file: 'features/mixer/MixerView.svelte',
				instrument: [],
				mixer: ['Labelled horizontally scrollable row of channel strips'],
				transport: [],
				source: '10B §4.3 · conventions §5.3',
				guidance:
					'Horizontal scrolling is the required overflow strategy, not a fallback. The region is labelled and keyboard-scrollable. At 1024×640 and 200% zoom strips stay usable — never shrink controls below usable size and never overlap Master. Verify with realistic 16-channel names.'
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
					'Each such channel appears exactly once, with no mix controls, no meter, and no instrument controls.'
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
					'A clearly labelled Advanced region holds metadata and ignored-channel state so it never competes with the sound-design controls.'
			},
			{
				slug: 'dialog',
				name: 'Dialog',
				file: 'components/ConfirmDialog.svelte (exists) + generic dialog shell',
				instrument: ['Patch browser', 'Patch save', 'Role-change confirmation'],
				mixer: ['Sound-set apply', 'Normalize confirmation'],
				transport: [],
				source: '09B §4.6 · 10B §4.5–4.6',
				guidance:
					'Cancel, Escape, close, and channel change all perform zero work, restore the committed sound, and release any preview handle. Apply is the only path that commits.'
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
					'Searchable and keyboard-operable with Factory/User grouping. Browsing may audition temporarily, but Apply is the only project commit. Factory records cannot be overwritten or deleted; a modified Factory sound saves as a new User UUID.'
			},
			{
				slug: 'recall-preview',
				name: 'RecallPreview',
				file: 'features/presets/SoundSetApplyDialog.svelte',
				instrument: [],
				mixer: ['Sound-set assignments / unchanged / discarded lists'],
				transport: [],
				source: '10B §4.6',
				guidance:
					'Renders the shared preview lists produced by 10A. Confirmed apply calls applySoundSetToProject, then replaceProject, then syncProject — never duplicate matching or compose replaceChannels/updateMaster. Apply does not move the main tab, bank selectors, or browser state.'
			},
			{
				slug: 'sound-set-panel',
				name: 'SoundSetPanel',
				file: 'features/presets/SoundSetPanel.svelte',
				instrument: [],
				mixer: ['Sound set list, capture description, Save / Apply / Delete'],
				transport: [],
				source: '10B §4.6',
				guidance:
					'Lives only in the global Mixer. States exactly what it captures: channel names, roles, enabled flags, instruments, mix, and master. No MIDI, loop, tempo, export settings, sync, or workspace UI.'
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
					'Supplemental only and aria-hidden. Timer-free component rendering one flat bordered fill; the layout-installed lifecycle drives it. No gradient, canvas, segments, or peak animation. Reduced motion selects 5Hz. Target registration follows rendered strips and cleans up on view and project changes.'
			},
			{
				slug: 'signal-status',
				name: 'SignalStatus',
				file: 'features/mixer/ChannelStrip.svelte',
				instrument: [],
				mixer: ['Audible / Muted / Silenced by solo / Not included'],
				transport: [],
				source: '10B §4.3–4.4 · conventions §6',
				guidance:
					'Explicit text from the 10A audibility resolver. Channel state must be fully understandable with meters and color ignored.'
			},
			{
				slug: 'clip-indicator',
				name: 'ClipIndicator',
				file: 'features/mixer/LevelMeter.svelte',
				instrument: [],
				mixer: ['Per-channel clip', 'Master clip'],
				transport: [],
				source: '10B §4.4',
				guidance: 'Latched CLIP text plus a Reset action. Color alone never signals clipping.'
			},
			{
				slug: 'value-readout',
				name: 'ValueReadout',
				file: 'part of ParameterKnob / VerticalParameterFader',
				instrument: ['Every numeric parameter'],
				mixer: ['Every numeric parameter'],
				transport: ['Tempo'],
				source: 'conventions §5.2 · §6',
				guidance:
					'Visible value and unit in the mono font. The marker and the accessible value text always reflect the real value, even when the slider position is mapped logarithmically.'
			},
			{
				slug: 'note-readout',
				name: 'NoteReadout',
				file: 'part of ParameterKnob (percussion root note)',
				instrument: ['Percussion root note'],
				mixer: [],
				transport: [],
				source: '09B §4.4 · conventions §5.2',
				guidance:
					'Dedicated stepped pot showing note name and MIDI number as C4 (60) via formatMidiNote(). Never banked.'
			},
			{
				slug: 'pan-readout',
				name: 'PanReadout',
				file: 'part of ChannelStrip pan pot',
				instrument: [],
				mixer: ['Channel pan'],
				transport: [],
				source: '10B §4.3',
				guidance: 'C, L50, R30 formatting. Pan is a dedicated knob; do not create a G/P bank.'
			},
			{
				slug: 'time-readout',
				name: 'TimeReadout',
				file: 'features/transport/PositionReadout.svelte',
				instrument: [],
				mixer: [],
				transport: ['Position / duration plus bars and beats'],
				source: '10B §4.1',
				guidance:
					'Renders formatSeconds and ticksToBarsBeats output from 10A. Components never re-derive time or tempo maps.'
			},
			{
				slug: 'tempo-readout',
				name: 'TempoReadout',
				file: 'features/transport/TempoControls.svelte',
				instrument: [],
				mixer: [],
				transport: ['Effective BPM beside the tempo pot'],
				source: '10B §4.1',
				guidance: 'Shows the effective BPM for the current multiplier. Tempo is never banked.'
			},
			{
				slug: 'loop-readout',
				name: 'LoopReadout',
				file: 'features/transport/LoopControls.svelte',
				instrument: [],
				mixer: ['Resolved loop ticks under the loop fields'],
				transport: [],
				source: '10B §4.2',
				guidance:
					'Loop sits above the strips in the global Mixer. Loop and tempo are arrangement state and are excluded from sound sets.'
			},
			{
				slug: 'edited-indicator',
				name: 'EditedIndicator',
				file: 'features/presets/InstrumentPresetHeader.svelte',
				instrument: ['Modified marker beside the patch name'],
				mixer: [],
				transport: [],
				source: '09B §4.6',
				guidance:
					'Text marker driven by the delivered modified-state comparison; not a colored dot.'
			},
			{
				slug: 'error-text',
				name: 'ErrorText',
				file: 'part of every numeric and text field',
				instrument: ['Numeric field validation'],
				mixer: ['Loop field validation', 'Numeric field validation'],
				transport: ['Tempo and seek validation'],
				source: 'conventions §5.2 · §6',
				guidance:
					'Readable text linked by aria-describedby. Validation errors and sync state are always rendered as text, never as color or icon alone.'
			},
			{
				slug: 'help-text',
				name: 'HelpText',
				file: 'shared inline help',
				instrument: ['Tracking help', 'Glyph help', 'Bank initial help'],
				mixer: ['Sound-set scope statement'],
				transport: ['Space shortcut help'],
				source: '09B §4.3–4.6 · 10B §4.1 · §4.6',
				guidance:
					'Every compact initial and glyph has hover and focus help with a full accessible name. Help is visible text, not a title attribute alone.'
			},
			{
				slug: 'engine-status',
				name: 'EngineStatus',
				file: 'features/transport/TransportControls.svelte',
				instrument: ['Retry after audio failure; editing stays enabled'],
				mixer: ['Mixer and project controls stay editable and saveable'],
				transport: ['Suspended context text plus a visible Resume button'],
				source: '09B §4.7 · 10B §4.1 · §4.7',
				guidance:
					'Never auto-resume — audio starts only from a user gesture. Audio denial or suspension must not block editing, saving, or future persistence.'
			},
			{
				slug: 'status-region',
				name: 'StatusRegion',
				file: 'components/StatusRegion.svelte (exists)',
				instrument: ['Errors and transient status'],
				mixer: ['Errors and transient status'],
				transport: ['Errors and transient status'],
				source: 'conventions §6',
				guidance: 'One aria-live="polite" region for the whole app. Reuse as delivered.'
			},
			{
				slug: 'empty-state',
				name: 'EmptyState',
				file: 'components/EmptyState.svelte (exists)',
				instrument: ['No channel selected'],
				mixer: ['No channels'],
				transport: ['No song loaded'],
				source: 'phase 04',
				guidance: 'Reuse as delivered.'
			}
		]
	}
];
