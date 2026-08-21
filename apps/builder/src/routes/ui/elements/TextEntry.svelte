<script lang="ts">
	/**
	 * Narrow loop-field specimen. Validation is local to the /ui catalog.
	 *
	 * Modular footprint (00-conventions.md §5.4): 96x96 (--mod-3 x --band-3). Three stacked rows —
	 * label (16), the input band (32), and a reserved message area (48) — sum to the full 96px height
	 * with zero gap between them. The message area is itself padding 16 (--pad-3) + two 16px text
	 * lines (--label-line x2): 16 + 16 + 16 = 48, so a validation message appearing or growing to two
	 * lines never changes the module's footprint. The input spans the full 96px border-box width.
	 */
	const uid = $props.id();
	const inputId = `${uid}-bars-beats`;
	const errorId = `${uid}-bars-beats-error`;
	let value = $state('8');
	let error = $state('Enter bars.beats, for example 8.1.');

	function validate() {
		error = /^\d+\.\d+$/.test(value) ? '' : 'Enter bars.beats, for example 8.1.';
	}
</script>

<div class="text-entry">
	<label for={inputId}>Loop start</label>
	<input
		id={inputId}
		class:invalid={error.length > 0}
		type="text"
		bind:value
		spellcheck="false"
		inputmode="numeric"
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={errorId}
		oninput={validate}
	/>
	<!-- The fixed message slot prevents the narrow field from moving when validation changes. -->
	<p id={errorId} class:error-message={error.length > 0} class="message">
		{error || 'Valid bars.beats value.'}
	</p>
</div>

<style>
	.text-entry {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 0;
		width: var(--mod-3);
		height: var(--band-3);
		font-size: var(--font-size-sm);
	}

	label {
		box-sizing: border-box;
		height: var(--label-line);
		overflow: hidden;
		color: var(--color-text);
		font-weight: 700;
		line-height: var(--label-line);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	input {
		box-sizing: border-box;
		width: 100%;
		height: var(--control-height);
		padding: 0 var(--pad-2);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-background);
		color: var(--color-text);
		font-family: var(--font-mono);
		font-size: var(--font-size-base);
		font-variant-numeric: tabular-nums;
	}

	input:hover {
		background: var(--color-surface);
	}

	input:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	input.invalid {
		border-color: var(--color-danger);
	}

	/* Reserved message area: padding-top 16 (--pad-3) + two 16px lines (--label-line) = 48px, fixed
	   regardless of whether the message is showing, so it never changes the module's footprint. */
	.message {
		box-sizing: border-box;
		height: calc(var(--pad-3) + var(--label-line) * 2);
		overflow: hidden;
		margin: 0;
		padding-top: var(--pad-3);
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
		line-height: var(--label-line);
	}

	.message.error-message {
		color: var(--color-danger);
		font-weight: 700;
	}
</style>
