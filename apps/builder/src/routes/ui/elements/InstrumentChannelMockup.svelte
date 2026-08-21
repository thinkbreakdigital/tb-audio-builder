<script lang="ts">
	/** Static pitched-instrument pane composition for the /ui review surface. */
	import ControlSection from './ControlSection.svelte';
	import DualRotaryPot from './DualRotaryPot.svelte';
	import EnvelopeDisplay from './EnvelopeDisplay.svelte';
	import PatchHeader from './PatchHeader.svelte';
	import RotaryPot from './RotaryPot.svelte';
	import SegmentSwitch from './SegmentSwitch.svelte';
	import SelectorSwitch from './SelectorSwitch.svelte';
	import ToggleSwitch from './ToggleSwitch.svelte';
	import BandpassIcon from './icons/BandpassIcon.svelte';
	import HighpassIcon from './icons/HighpassIcon.svelte';
	import LowpassIcon from './icons/LowpassIcon.svelte';

	type EnvelopeParameter = 'attack' | 'decay' | 'sustain' | 'release';
	type PitchParameter = 'octave' | 'semitone' | 'fine';

	const PITCH_SEGMENTS: { value: PitchParameter; initial: string; label: string }[] = [
		{ value: 'octave', initial: 'O', label: 'Octave' },
		{ value: 'semitone', initial: 'S', label: 'Semitone' },
		{ value: 'fine', initial: 'F', label: 'Fine' }
	];

	const PITCH_POT_SPECS: Record<
		PitchParameter,
		{
			max: number;
			min: number;
			step: number;
			fineStep: number;
			unit: string;
			decimals: number;
			defaultValue: number;
		}
	> = {
		octave: {
			min: -3,
			max: 3,
			step: 1,
			fineStep: 1,
			unit: 'oct',
			decimals: 0,
			defaultValue: 0
		},
		semitone: {
			min: -11,
			max: 11,
			step: 1,
			fineStep: 1,
			unit: 'st',
			decimals: 0,
			defaultValue: 0
		},
		fine: {
			min: -99,
			max: 99,
			step: 1,
			fineStep: 1,
			unit: 'ct',
			decimals: 0,
			defaultValue: 0
		}
	};

	const ENVELOPE_SEGMENTS: { value: EnvelopeParameter; initial: string; label: string }[] = [
		{ value: 'attack', initial: 'A', label: 'Attack' },
		{ value: 'decay', initial: 'D', label: 'Decay' },
		{ value: 'sustain', initial: 'S', label: 'Sustain' },
		{ value: 'release', initial: 'R', label: 'Release' }
	];

	const AMPLITUDE_POT_SPECS: Record<
		EnvelopeParameter,
		{
			label: string;
			max: number;
			step: number;
			fineStep: number;
			unit: string;
			decimals: number;
			defaultValue: number;
		}
	> = {
		attack: {
			label: 'Attack',
			max: 5000,
			step: 10,
			fineStep: 1,
			unit: 'ms',
			decimals: 0,
			defaultValue: 10
		},
		decay: {
			label: 'Decay',
			max: 5000,
			step: 10,
			fineStep: 1,
			unit: 'ms',
			decimals: 0,
			defaultValue: 250
		},
		sustain: {
			label: 'Sustain',
			max: 100,
			step: 1,
			fineStep: 1,
			unit: '%',
			decimals: 0,
			defaultValue: 70
		},
		release: {
			label: 'Release',
			max: 5000,
			step: 10,
			fineStep: 1,
			unit: 'ms',
			decimals: 0,
			defaultValue: 300
		}
	};

	const FILTER_TYPES = [
		{ value: 'lowpass', initial: 'L', label: 'Lowpass', icon: LowpassIcon },
		{ value: 'bandpass', initial: 'B', label: 'Bandpass', icon: BandpassIcon },
		{ value: 'highpass', initial: 'H', label: 'Highpass', icon: HighpassIcon }
	];

	const VOICE_MODES = [
		{ value: 'mono', initial: 'MONO', label: 'Mono' },
		{ value: 'poly', initial: 'POLY', label: 'Poly' }
	];

	let filterEnabled = $state(true);
	let filterEnvelopeEnabled = $state(true);
	let pitchParameter = $state<PitchParameter>('octave');
	let pitchTuning = $state<Record<PitchParameter, number>>({
		octave: 0,
		semitone: 0,
		fine: 0
	});
	let amplitudeParameter = $state<EnvelopeParameter>('attack');
	let amplitudeEnvelope = $state<Record<EnvelopeParameter, number>>({
		attack: 10,
		decay: 250,
		sustain: 70,
		release: 300
	});
	let filterType = $state('lowpass');
	let filterEnvelopeParameter = $state('attack');
	let voiceMode = $state('poly');
	const polyphonic = $derived(voiceMode === 'poly');
	const pitchPot = $derived(PITCH_POT_SPECS[pitchParameter]);
	const amplitudePot = $derived(AMPLITUDE_POT_SPECS[amplitudeParameter]);
</script>

<section class="instrument-pane" aria-labelledby="instrument-pane-title">
	<header class="channel-header">
		<div class="channel-title">
			<p class="eyebrow">Instrument channel</p>
			<h2 id="instrument-pane-title">Electric piano</h2>
		</div>
		<PatchHeader embedded />
		<span class="role">PITCHED</span>
	</header>

	<div class="sections">
		<ControlSection legend="Oscillator" width="oscillator">
			<div class="pitch-bank">
				<SelectorSwitch hideActiveName />
				<SegmentSwitch
					legend="Pitch parameter"
					hideLegend
					collapseLegend
					segments={PITCH_SEGMENTS}
					bind:selected={pitchParameter}
				/>
			</div>
			<RotaryPot
				label="Pitch"
				bind:value={pitchTuning[pitchParameter]}
				min={pitchPot.min}
				max={pitchPot.max}
				step={pitchPot.step}
				fineStep={pitchPot.fineStep}
				unit={pitchPot.unit}
				decimals={pitchPot.decimals}
				defaultValue={pitchPot.defaultValue}
				scale="linear"
				size="compact"
			/>
			<RotaryPot
				label="Level"
				value={0.8}
				min={0}
				max={1}
				step={0.01}
				fineStep={0.001}
				unit=""
				decimals={2}
				defaultValue={0.8}
				scale="linear"
				size="compact"
			/>
		</ControlSection>

		<ControlSection legend="Amplitude" width="compact" joined>
			<div class="envelope-bank">
				<EnvelopeDisplay
					label="Amplitude ADSR envelope curve"
					attack={amplitudeEnvelope.attack}
					decay={amplitudeEnvelope.decay}
					sustain={amplitudeEnvelope.sustain}
					release={amplitudeEnvelope.release}
				/>
				<SegmentSwitch
					legend="Amplitude envelope parameter"
					hideLegend
					collapseLegend
					segments={ENVELOPE_SEGMENTS}
					bind:selected={amplitudeParameter}
				/>
			</div>
			<RotaryPot
				label={amplitudePot.label}
				hideLabel
				bind:value={amplitudeEnvelope[amplitudeParameter]}
				min={0}
				max={amplitudePot.max}
				step={amplitudePot.step}
				fineStep={amplitudePot.fineStep}
				unit={amplitudePot.unit}
				decimals={amplitudePot.decimals}
				defaultValue={amplitudePot.defaultValue}
				scale="linear"
				size="compact"
			/>
		</ControlSection>

		<ControlSection legend="Filter" width="compact" joined disabled={!filterEnabled}>
			<div class="filter-bank">
				<ToggleSwitch label="On/Off" hideHint bind:checked={filterEnabled} />
				<SegmentSwitch
					legend="Filter type"
					hideLegend
					collapseLegend
					disabled={!filterEnabled}
					segments={FILTER_TYPES}
					bind:selected={filterType}
				/>
			</div>
			<DualRotaryPot disabled={!filterEnabled} />
		</ControlSection>

		<ControlSection legend="Filter Envelope" joined disabled={!filterEnabled}>
			<div class="filter-envelope-bank">
				<ToggleSwitch
					label="On/Off"
					hideHint
					disabled={!filterEnabled}
					bind:checked={filterEnvelopeEnabled}
				/>
				<SegmentSwitch
					legend="Filter envelope parameter"
					hideLegend
					collapseLegend
					disabled={!filterEnabled || !filterEnvelopeEnabled}
					segments={ENVELOPE_SEGMENTS}
					bind:selected={filterEnvelopeParameter}
				/>
			</div>
			<RotaryPot
				label="Envelope"
				value={0.2}
				min={0}
				max={2}
				step={0.01}
				fineStep={0.001}
				unit="s"
				decimals={2}
				defaultValue={0.2}
				scale="linear"
				size="compact"
				disabled={!filterEnabled || !filterEnvelopeEnabled}
			/>
			<RotaryPot
				label="Env amt"
				value={0}
				min={-1}
				max={1}
				step={0.01}
				fineStep={0.001}
				unit=""
				decimals={2}
				defaultValue={0}
				scale="linear"
				size="compact"
				disabled={!filterEnabled || !filterEnvelopeEnabled}
			/>
		</ControlSection>

		<ControlSection legend="Voices" width="compact" joined>
			<SegmentSwitch legend="Voice mode" segments={VOICE_MODES} bind:selected={voiceMode} />
			<RotaryPot
				label="Glide"
				value={0.08}
				min={0.005}
				max={2}
				step={0.005}
				fineStep={0.001}
				unit="s"
				decimals={3}
				defaultValue={0.08}
				scale="linear"
				size="compact"
				disabled={polyphonic}
			/>
		</ControlSection>
	</div>
</section>

<style>
	.instrument-pane {
		box-sizing: border-box;
		width: 100%;
		padding: var(--space-2);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-background);
	}

	.channel-header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
	}

	.channel-title {
		flex: 0 0 var(--mod-5);
		min-width: 0;
	}

	.eyebrow {
		margin: 0 0 var(--space-1);
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
	}

	h2 {
		margin: 0;
		font-size: var(--font-size-base);
	}

	.role {
		flex: 0 0 auto;
		padding: 0 var(--space-1);
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--radius);
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
	}

	.envelope-bank {
		display: flex;
		flex: 0 0 var(--mod-3);
		flex-direction: column;
		width: var(--mod-3);
		height: var(--band-3);
	}

	.pitch-bank {
		display: flex;
		flex: 0 0 var(--mod-2);
		flex-direction: column;
		width: var(--mod-2);
		height: var(--band-3);
	}

	.filter-bank {
		display: flex;
		flex: 0 0 var(--mod-2);
		flex-direction: column;
		align-items: flex-start;
		gap: var(--pad-1);
		width: var(--mod-2);
		height: calc(var(--band-3) + var(--pad-1));
	}

	.filter-envelope-bank {
		display: flex;
		flex: 0 0 var(--mod-3);
		flex-direction: column;
		align-items: flex-start;
		gap: var(--pad-1);
		width: var(--mod-3);
		height: calc(var(--band-3) + var(--pad-1));
	}

	.sections {
		display: flex;
		gap: 0;
		margin-top: var(--space-2);
		overflow-x: auto;
	}
</style>
