<script lang="ts">
	import LevelMeter from './LevelMeter.svelte';
	import LinearPot from './LinearPot.svelte';
	import ToggleSwitch from './ToggleSwitch.svelte';
	import ValueReadout from './ValueReadout.svelte';

	/** Static master-region specimen; compressor controls remain visible when bypassed. */
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
				shaftHeight="var(--mixer-level-rail-height)"
			/>
			<LevelMeter levelDb={masterVolumeDb} height="var(--mixer-level-rail-height)" showScale />
		</div>
	</div>
	<ToggleSwitch label="Compressor" bind:checked={compressorEnabled} />
</section>

<style>
	.master-strip {
		/* Border-box height: 1 + 7 slack + 48 + 32 + 224 + 64 + 7 slack + 1 = 384.
		   Matching edge tracks put both level rails at 88..312 without off-scale padding. */
		display: grid;
		justify-items: center;
		align-items: start;
		gap: 0;
		width: var(--mod-5);
		height: var(--mixer-strip-height);
		box-sizing: border-box;
		grid-template-rows:
			minmax(0, 1fr)
			calc(var(--band-1) + var(--label-line))
			calc(var(--band-1) + var(--mixer-level-rail-height))
			var(--band-2)
			minmax(0, 1fr);
		padding: 0;
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-surface);
	}

	.master-strip::before,
	.master-strip::after {
		content: '';
	}

	header {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: var(--space-1);
		width: 100%;
		height: 100%;
		padding: 0 var(--pad-2);
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
		grid-template-rows: var(--band-1) var(--mixer-level-rail-height);
		justify-items: center;
		width: 100%;
		height: 100%;
		min-height: 0;
		gap: 0;
		font-size: var(--font-size-sm);
	}

	.level-rail {
		display: flex;
		justify-content: center;
		align-items: stretch;
		gap: 0;
		width: var(--mod-4);
		height: var(--mixer-level-rail-height);
		min-height: 0;
	}
</style>
