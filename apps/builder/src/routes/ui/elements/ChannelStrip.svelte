<script lang="ts">
	import LevelMeter from './LevelMeter.svelte';
	import LinearPot from './LinearPot.svelte';
	import LatchingSwitch from './LatchingSwitch.svelte';
	import ValueReadout from './ValueReadout.svelte';

	/** Static compact mixer-strip specimen. The latches are deliberately local to the catalog. */
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
				shaftHeight="var(--mixer-level-rail-height)"
			/>
			<LevelMeter levelDb={volumeDb} height="var(--mixer-level-rail-height)" showScale />
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
		/* Border-box height: 1 + 7 slack + 24 + 24 + 32 + 224 + 32 + 32 + 7 slack + 1 = 384.
		   The edge tracks absorb the remainder so the strip does not invent off-scale padding. */
		display: grid;
		justify-items: center;
		align-items: start;
		gap: 0;
		width: var(--mod-4);
		height: var(--mixer-strip-height);
		box-sizing: border-box;
		grid-template-rows:
			minmax(0, 1fr)
			calc(var(--band-1) - var(--u))
			calc(var(--band-1) - var(--u))
			calc(var(--band-1) + var(--mixer-level-rail-height))
			var(--band-1)
			var(--band-1)
			minmax(0, 1fr);
		padding: 0;
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-background);
	}

	.channel-strip::before,
	.channel-strip::after {
		content: '';
	}

	.channel-name {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		padding: 0 var(--pad-2);
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
		box-sizing: border-box;
		display: flex;
		align-items: center;
		height: 100%;
		padding: 0 var(--pad-1);
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--radius);
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.level-section {
		display: grid;
		grid-template-rows: var(--band-1) var(--mixer-level-rail-height);
		justify-items: center;
		width: 100%;
		height: 100%;
		min-height: 0;
		gap: 0;
	}

	.level-rail {
		display: flex;
		justify-content: center;
		align-items: stretch;
		gap: 0;
		width: 100%;
		height: var(--mixer-level-rail-height);
		min-height: 0;
	}

	.level-rail > :global(*) {
		min-width: 0;
	}
</style>
