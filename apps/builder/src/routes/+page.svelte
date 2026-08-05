<svelte:head>
	<title>ThinkBreak Web Audio Builder</title>
	<meta
		name="description"
		content="Build portable synthesized Web Audio projects from MIDI compositions."
	/>
</svelte:head>

<main>
	<h1>ThinkBreak Web Audio Builder</h1>
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}

	:global(html) {
		background: #f6f1e7;
	}

	:global(body) {
		margin: 0;
		font-family: 'Space Grotesk', sans-serif;
	}

	main {
		display: grid;
		min-height: 100dvh;
		place-items: center;
		padding: clamp(1.5rem, 5vw, 4rem);
		background:
			linear-gradient(
				115deg,
				transparent 48%,
				rgb(15 76 117 / 8%) 48%,
				rgb(15 76 117 / 8%) 52%,
				transparent 52%
			),
			radial-gradient(circle at 50% 50%, #fffdf8 0%, #f6f1e7 68%);
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
</style>
