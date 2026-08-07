<script lang="ts">
	interface Props {
		fading: boolean;
		onstart: () => void;
	}

	let { fading, onstart }: Props = $props();
</script>

<!--
	The landing screen is the one deliberate exception to the flat-surface rules in
	00-conventions.md §5: it keeps the original gradient treatment and its own display palette.
	Everything behind it follows the token sheet.
-->
<div class="landing" class:fading aria-hidden={fading ? 'true' : undefined}>
	<div class="landing-inner">
		<h1>ThinkBreak Web Audio Builder</h1>
		<button type="button" class="start" onclick={onstart}>Start</button>
	</div>
</div>

<style>
	.landing {
		position: fixed;
		inset: 0;
		z-index: 10;
		display: grid;
		place-items: center;
		padding: clamp(1.5rem, 5vw, 4rem);
		font-family: 'Space Grotesk', var(--font-sans);
		background:
			linear-gradient(
				115deg,
				transparent 48%,
				rgb(15 76 117 / 8%) 48%,
				rgb(15 76 117 / 8%) 52%,
				transparent 52%
			),
			radial-gradient(circle at 50% 50%, #fffdf8 0%, #f6f1e7 68%);
		opacity: 1;
		transition: opacity 350ms;
	}

	.landing.fading {
		opacity: 0;
		pointer-events: none;
	}

	.landing-inner {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: clamp(1.5rem, 4vw, 3rem);
	}

	h1 {
		max-width: 14ch;
		margin: 0;
		color: #1b262c;
		font-size: clamp(2.75rem, 9vw, 7.5rem);
		font-weight: 700;
		letter-spacing: -0.065em;
		line-height: 0.88;
		text-align: center;
		text-wrap: balance;
	}

	.start {
		padding: 0.75rem 2.5rem;
		border: 1px solid #1b262c;
		border-radius: var(--radius);
		background: none;
		color: #1b262c;
		font-size: var(--font-size-lg);
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			background-color 100ms,
			color 100ms;
	}

	.start:hover {
		background: #1b262c;
		color: #fffdf8;
	}
</style>
