<script lang="ts">
	import LevelMeter from './LevelMeter.svelte';
	import LinearPot from './LinearPot.svelte';
	import LatchingSwitch from './LatchingSwitch.svelte';
	import ValueReadout from './ValueReadout.svelte';

	/** Static compact mixer-strip specimen. The latches are deliberately local to the catalog. */
	const uid = $props.id();
	const volumeId = `${uid}-volume`;
	let muted = $state(false);
	let soloed = $state(false);
	let volumeDb = $state(-6);
	let clipLatched = $state(false);

	function formatDb(valueDb: number): string {
		return `${valueDb > 0 ? '+' : ''}${valueDb.toFixed(1)} dB`;
	}

	function resetClip() {
		clipLatched = false;
	}

	$effect(() => {
		if (volumeDb >= 0) clipLatched = true;
	});
</script>

<section class="channel-strip" aria-label="Channel strip: Electric piano">
	<button class="channel-name" type="button" title="Open Electric piano in Instrument">
		Electric piano
	</button>
	<span class="role">PITCHED</span>

	<div class="level-section">
		<ValueReadout
			value={volumeDb}
			unit="dB"
			clickable
			clipped={clipLatched}
			onclick={resetClip}
			ariaLabel={`${clipLatched ? 'Clip detected. ' : ''}Current volume ${formatDb(volumeDb)}. Activate to reset clip.`}
		/>
		<div class="level-rail">
			<LinearPot
				bind:value={volumeDb}
				min={-48}
				max={6}
				step={1}
				fineStep={1}
				defaultValue={-6}
				decimals={0}
				showLabel={false}
				showReadout={false}
				shaftHeight="100%"
			/>
			<LevelMeter levelDb={volumeDb} height="100%" showScale />
		</div>
	</div>

	<LinearPot
		label="Pan"
		orientation="horizontal"
		value={0}
		min={-50}
		max={50}
		step={1}
		fineStep={1}
		defaultValue={0}
		decimals={0}
		density="compact"
	/>

	<LatchingSwitch bind:solo={soloed} bind:mute={muted} label="Electric piano latches" />
</section>

<style>
	.channel-strip {
		display: grid;
		justify-items: center;
		gap: var(--space-2);
		width: 116px;
		height: var(--mixer-strip-height);
		box-sizing: border-box;
		grid-template-rows: auto auto minmax(0, 1fr) auto auto;
		padding: var(--space-2);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-background);
	}

	.channel-name {
		max-width: 100%;
		padding: 0;
		border: 0;
		background: none;
		color: var(--color-text);
		font: inherit;
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.role {
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.role {
		padding: 0 var(--space-1);
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--radius);
	}

	.level-section {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		justify-items: center;
		min-height: 0;
		gap: var(--space-1);
	}

	.level-rail {
		display: flex;
		align-items: stretch;
		gap: var(--space-2);
		height: auto;
		min-height: 0;
	}

	@media (max-width: 640px) {
		.channel-strip {
			width: 128px;
		}
	}
</style>
