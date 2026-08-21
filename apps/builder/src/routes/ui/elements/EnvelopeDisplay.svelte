<script lang="ts">
	interface Props {
		label?: string;
		attack?: number;
		decay?: number;
		sustain?: number;
		release?: number;
	}

	let {
		label = 'ADSR curve',
		attack = 10,
		decay = 250,
		sustain = 70,
		release = 300
	}: Props = $props();

	const TIME_MAX_MS = 5000;

	function clamp(value: number, min: number, max: number): number {
		return Math.min(max, Math.max(min, value));
	}

	function timeProgress(value: number): number {
		return Math.log1p(clamp(value, 0, TIME_MAX_MS)) / Math.log1p(TIME_MAX_MS);
	}

	const attackX = $derived(1 + timeProgress(attack) * 12);
	const decayX = $derived(15 + timeProgress(decay) * 12);
	const sustainY = $derived(22 - (clamp(sustain, 0, 100) / 100) * 20);
	const releaseStartX = $derived(51 - timeProgress(release) * 12);
	const curvePath = $derived(
		`M1 22 L${attackX} 2 L${decayX} ${sustainY} L${releaseStartX} ${sustainY} L51 22`
	);
</script>

<div class="envelope-display" role="img" aria-label={label}>
	<span class="window" aria-hidden="true">
		<svg viewBox="0 0 52 24" fill="none" preserveAspectRatio="none">
			<path
				d={curvePath}
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
	</span>
</div>

<style>
	.envelope-display {
		box-sizing: border-box;
		width: var(--mod-3);
		height: calc(var(--band-2) - var(--label-line));
	}

	.window {
		box-sizing: border-box;
		display: flex;
		height: 100%;
		padding: var(--pad-1) var(--pad-3) 0;
	}

	.window svg {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-background);
		color: var(--color-text);
	}
</style>
