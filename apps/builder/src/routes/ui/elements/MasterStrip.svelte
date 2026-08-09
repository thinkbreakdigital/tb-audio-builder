<script lang="ts">
	import LevelMeter from './LevelMeter.svelte';
	import LinearPot from './LinearPot.svelte';
	import ToggleSwitch from './ToggleSwitch.svelte';
	import ValueReadout from './ValueReadout.svelte';

	/** Static master-region specimen; compressor controls remain visible when bypassed. */
	const uid = $props.id();
	const volumeId = `${uid}-volume`;
	const compressorId = `${uid}-compressor`;
	let compressorEnabled = $state(false);
	let masterVolumeDb = $state(-3);
	let clipLatched = $state(false);

	function formatDb(valueDb: number): string {
		return `${valueDb > 0 ? '+' : ''}${valueDb.toFixed(1)} dB`;
	}

	function resetClip() {
		clipLatched = false;
	}

	$effect(() => {
		if (masterVolumeDb >= 0) clipLatched = true;
	});
</script>

<section class="master-strip" aria-label="Master strip">
	<header><span>MASTER</span><span class="separator" aria-hidden="true"></span></header>
	<div class="volume">
		<ValueReadout
			value={masterVolumeDb}
			unit="dB"
			clickable
			clipped={clipLatched}
			onclick={resetClip}
			ariaLabel={`${clipLatched ? 'Clip detected. ' : ''}Current volume ${formatDb(masterVolumeDb)}. Activate to reset clip.`}
		/>
		<div class="level-rail">
			<LinearPot
				bind:value={masterVolumeDb}
				min={-48}
				max={6}
				step={1}
				fineStep={1}
				defaultValue={-3}
				decimals={0}
				showLabel={false}
				showReadout={false}
				shaftHeight="100%"
			/>
			<LevelMeter levelDb={masterVolumeDb} height="100%" showScale />
		</div>
	</div>
	<ToggleSwitch label="Compressor" align="center" bind:checked={compressorEnabled} />
</section>

<style>
	.master-strip {
		display: grid;
		justify-items: center;
		gap: var(--space-2);
		width: 136px;
		height: var(--mixer-strip-height);
		box-sizing: border-box;
		grid-template-rows: auto minmax(0, 1fr) auto;
		padding: var(--space-2);
		border: 2px solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-surface);
	}

	header {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		width: 100%;
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		font-weight: 700;
	}

	.separator {
		flex: 1;
		border-top: var(--border-width) solid var(--color-border-strong);
	}

	.volume {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		justify-items: center;
		min-height: 0;
		gap: var(--space-1);
		font-size: var(--font-size-sm);
	}

	.level-rail {
		display: flex;
		align-items: stretch;
		gap: var(--space-2);
		height: auto;
		min-height: 0;
	}

	@media (max-width: 640px) {
		.master-strip {
			width: 156px;
		}
	}
</style>
