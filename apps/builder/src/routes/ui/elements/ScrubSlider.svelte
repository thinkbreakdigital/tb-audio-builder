<script lang="ts">
	/**
	 * Design specimen — horizontal transport seek bar. The one place in the app a horizontal
	 * <input type="range"> is allowed (conventions §5.2); everything continuous elsewhere is a
	 * rotary pot or the vertical Volume fader.
	 *
	 * Self-contained: local state only, no project/audio/persistence writes.
	 */

	export interface Props {
		label?: string;
		positionSeconds?: number;
		durationSeconds?: number;
		disabled?: boolean;
	}

	let {
		label = 'Position',
		positionSeconds = 64.25,
		durationSeconds = 192,
		disabled = false
	}: Props = $props();

	const uid = $props.id();
	const rangeId = `${uid}-range`;
	const helpId = `${uid}-help`;

	// Stands in for the value a background poller would push in from the audio engine while a
	// song plays. It ticks forward on its own so the specimen has something to scrub against.
	// svelte-ignore state_referenced_locally
	let livePosition = $state(Math.min(Math.max(0, positionSeconds), durationSeconds));

	// SCRUB DRAFT: while the pointer (or keyboard) holds the thumb, `isScrubbing` is true and the
	// displayed position is `draftSeconds`, not `livePosition` — so an incoming poller tick can
	// never overwrite the thumb mid-drag. On release the draft commits back into `livePosition`
	// and the simulated poller resumes driving it. This local flag is the specimen stand-in for
	// what, in production, is a real poller (see playback-poller.ts) racing the pointer.
	let isScrubbing = $state(false);
	// svelte-ignore state_referenced_locally
	let draftSeconds = $state(livePosition);

	const displaySeconds = $derived(isScrubbing ? draftSeconds : livePosition);

	$effect(() => {
		if (disabled) return;
		const timer = setInterval(() => {
			if (isScrubbing) return;
			const next = livePosition + 0.1;
			livePosition = next >= durationSeconds ? 0 : next;
		}, 100);
		return () => clearInterval(timer);
	});

	function formatTime(totalSeconds: number): string {
		let ms = Math.round(Math.max(0, totalSeconds) * 1000);
		const minutes = Math.floor(ms / 60000);
		ms -= minutes * 60000;
		const seconds = Math.floor(ms / 1000);
		const millis = ms - seconds * 1000;
		return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
	}

	// Bars.beats readout: illustrative fixed 4/4-at-120bpm mapping. The real conversion (tick <->
	// second <-> bar.beat) lives once in @thinkbreak/audio-runtime and is out of scope for a
	// self-contained specimen.
	function formatBarsBeats(totalSeconds: number): string {
		const beatsPerBar = 4;
		const secondsPerBeat = 0.5;
		const totalBeats = Math.max(0, totalSeconds) / secondsPerBeat;
		const bar = Math.floor(totalBeats / beatsPerBar) + 1;
		const beatInBar = (totalBeats % beatsPerBar) + 1;
		return `Bar ${bar} | ${beatInBar.toFixed(1)}`;
	}

	function beginScrub() {
		if (disabled) return;
		draftSeconds = livePosition;
		isScrubbing = true;
	}

	function onInput(event: Event) {
		if (disabled) return;
		if (!isScrubbing) beginScrub();
		draftSeconds = Number((event.currentTarget as HTMLInputElement).value);
	}

	function commitScrub() {
		if (!isScrubbing) return;
		livePosition = draftSeconds;
		isScrubbing = false;
	}
</script>

<div class="scrub-slider" class:is-disabled={disabled}>
	<label for={rangeId} class="scrub-label">{label}</label>

	<input
		id={rangeId}
		class="scrub-input"
		type="range"
		min="0"
		max={durationSeconds}
		step="0.1"
		value={displaySeconds}
		{disabled}
		oninput={onInput}
		onpointerdown={beginScrub}
		onpointerup={commitScrub}
		onkeyup={commitScrub}
		onblur={commitScrub}
		aria-describedby={disabled ? helpId : undefined}
	/>

	<div class="readouts">
		<span class="time-readout">{formatTime(displaySeconds)} / {formatTime(durationSeconds)}</span>
		<span class="bars-readout">{formatBarsBeats(displaySeconds)}</span>
	</div>

	{#if disabled}
		<p id={helpId} class="help">Seek is available once a song is loaded.</p>
	{/if}
</div>

<style>
	.scrub-slider {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		width: 100%;
	}

	.scrub-label {
		font-size: var(--font-size-sm);
		font-weight: 700;
		/* The label stays full-contrast even when disabled — the control dims, not the wayfinding. */
		color: var(--color-text);
	}

	.scrub-input {
		appearance: none;
		width: 100%;
		height: var(--control-height);
		margin: 0;
		background: transparent;
		cursor: pointer;
	}

	.scrub-input:disabled {
		cursor: not-allowed;
	}

	.scrub-input:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	.scrub-input::-webkit-slider-runnable-track {
		height: 6px;
		background: var(--color-surface-active);
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--radius);
	}

	.scrub-input::-moz-range-track {
		height: 6px;
		background: var(--color-surface-active);
		border: var(--border-width) solid var(--color-border);
		border-radius: var(--radius);
	}

	.scrub-input::-webkit-slider-thumb {
		appearance: none;
		width: 11px;
		height: 22px;
		margin-top: -8px;
		background: var(--color-accent);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
	}

	.scrub-input::-moz-range-thumb {
		width: 11px;
		height: 22px;
		background: var(--color-accent);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
	}

	.is-disabled .scrub-input::-webkit-slider-runnable-track {
		background: var(--color-surface);
	}

	.is-disabled .scrub-input::-webkit-slider-thumb {
		background: var(--color-border-strong);
	}

	.is-disabled .scrub-input::-moz-range-track {
		background: var(--color-surface);
	}

	.is-disabled .scrub-input::-moz-range-thumb {
		background: var(--color-border-strong);
	}

	.readouts {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-3);
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		color: var(--color-text);
	}

	.is-disabled .readouts {
		color: var(--color-text-muted);
	}

	.bars-readout {
		color: var(--color-text-muted);
	}

	.help {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}
</style>
