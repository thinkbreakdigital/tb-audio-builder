<script lang="ts">
	/** Narrow loop-field specimen. Validation is local to the /ui catalog. */
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
		display: grid;
		gap: var(--space-1);
		width: 86px;
		font-size: var(--font-size-sm);
	}

	label {
		color: var(--color-text);
		font-weight: 700;
	}

	input {
		box-sizing: border-box;
		width: 100%;
		height: var(--control-height);
		padding: 0 var(--space-2);
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

	.message {
		min-height: calc(var(--font-size-sm) * var(--line-height) * 2);
		margin: 0;
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
		line-height: var(--line-height);
	}

	.message.error-message {
		color: var(--color-danger);
		font-weight: 700;
	}

	@media (max-width: 640px) {
		.text-entry {
			width: 112px;
		}

		input {
			height: 36px;
			font-size: var(--font-size-lg);
		}
	}
</style>
