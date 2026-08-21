<script lang="ts">
	/** Static pitched-instrument pane composition for the /ui review surface. */
	import DualRotaryPot from './DualRotaryPot.svelte';
	import PatchHeader from './PatchHeader.svelte';
	import RotaryPot from './RotaryPot.svelte';
	import SegmentSwitch from './SegmentSwitch.svelte';
	import SelectorSwitch from './SelectorSwitch.svelte';
	import ToggleSwitch from './ToggleSwitch.svelte';

	let filterEnabled = $state(true);
	let vibratoEnabled = $state(false);
	let polyphonic = $state(true);
</script>

<section class="instrument-pane" aria-labelledby="instrument-pane-title">
	<header class="channel-header">
		<div>
			<p class="eyebrow">Instrument channel</p>
			<h2 id="instrument-pane-title">Electric piano</h2>
		</div>
		<span class="role">PITCHED</span>
	</header>

	<PatchHeader />

	<div class="sections">
		<section class="control-section" aria-labelledby="oscillator-title">
			<h3 id="oscillator-title">Oscillator</h3>
			<div class="control-row">
				<SelectorSwitch />
				<SegmentSwitch />
				<RotaryPot
					label="Level"
					value={0.8}
					min={0}
					max={1}
					step={0.01}
					fineStep={0.001}
					unit=""
					decimals={2}
					scale="linear"
					size="compact"
				/>
			</div>
		</section>

		<section class="control-section" aria-labelledby="amplitude-title">
			<h3 id="amplitude-title">Amplitude</h3>
			<div class="control-row">
				<SegmentSwitch
					legend="Envelope"
					segments={[
						{ value: 'attack', initial: 'A', label: 'Attack' },
						{ value: 'decay', initial: 'D', label: 'Decay' },
						{ value: 'sustain', initial: 'S', label: 'Sustain' },
						{ value: 'release', initial: 'R', label: 'Release' }
					]}
				/>
				<RotaryPot
					label="Envelope"
					value={0.2}
					min={0}
					max={2}
					step={0.01}
					fineStep={0.001}
					unit="s"
					decimals={2}
					scale="linear"
					size="compact"
				/>
			</div>
		</section>

		<section class="control-section" aria-labelledby="filter-title">
			<h3 id="filter-title">Filter</h3>
			<div class="control-row">
				<ToggleSwitch label="Enabled" bind:checked={filterEnabled} />
				<SelectorSwitch />
				<DualRotaryPot />
			</div>
		</section>

		<section class="control-section" aria-labelledby="modulation-title">
			<h3 id="modulation-title">Modulation</h3>
			<div class="control-row">
				<ToggleSwitch label="Vibrato" bind:checked={vibratoEnabled} />
				<DualRotaryPot />
				<RotaryPot
					label="Bend"
					value={2}
					min={0}
					max={24}
					step={1}
					fineStep={1}
					unit="st"
					decimals={0}
					scale="linear"
					size="compact"
				/>
			</div>
		</section>

		<section class="control-section" aria-labelledby="voices-title">
			<h3 id="voices-title">Voices</h3>
			<div class="control-row">
				<ToggleSwitch label="Poly" bind:checked={polyphonic} />
				<RotaryPot
					label="Max voices"
					value={8}
					min={1}
					max={32}
					step={1}
					fineStep={1}
					unit=""
					decimals={0}
					scale="linear"
					size="compact"
				/>
				<SelectorSwitch />
			</div>
		</section>
	</div>
</section>

<style>
	.instrument-pane {
		width: 100%;
		box-sizing: border-box;
		padding: var(--space-2);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-background);
	}

	.channel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}

	.eyebrow {
		margin: 0 0 var(--space-1);
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
	}

	h2,
	h3 {
		margin: 0;
	}

	h2 {
		font-size: var(--font-size-base);
	}
	h3 {
		font-size: var(--font-size-base);
	}

	.role {
		padding: 0 var(--space-1);
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--radius);
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
	}

	.sections {
		display: flex;
		gap: 0;
		margin-top: var(--space-2);
		overflow-x: auto;
	}

	.control-section {
		/* Exact outer footprint: 224x128. The 96px control row stays start-aligned and the grid row
		   absorbs the six vertical pixels left after border, padding, and the 16px heading. */
		box-sizing: border-box;
		display: grid;
		grid-template-rows: var(--label-line) minmax(0, 1fr);
		gap: 0;
		flex: 0 0 var(--mod-7);
		min-width: 0;
		height: var(--band-4);
		padding: var(--pad-1) 0;
		border: var(--border-width) solid var(--color-border);
		border-radius: 0;
		background: var(--color-surface);
	}

	.control-section + .control-section {
		border-inline-start-width: 0;
		padding-inline-start: var(--border-width);
	}

	.control-row {
		display: flex;
		flex-wrap: nowrap;
		align-items: start;
		gap: 0;
		width: 100%;
		height: var(--band-3);
		min-width: 0;
	}

	.control-row > :global(*) {
		min-width: 0;
	}

	@media (max-width: 640px) {
		.instrument-pane {
			padding: var(--space-2);
		}
	}
</style>
