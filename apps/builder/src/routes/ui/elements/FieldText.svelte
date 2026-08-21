<script lang="ts">
	/**
	 * Design specimen only — local state, zero wiring. See spec/implementation/00-conventions.md §5.2.
	 *
	 * Small text attached to a control, linked via aria-describedby (09B/10B, conventions §6). Help
	 * and error are one element with two tones, not two components. Both tones render the same
	 * border width (transparent for help, --color-danger for error), the same padding, and the same
	 * font-size/line-height — only color, weight, and the marker fill change between them. That is
	 * what keeps this element's own box the same size whether the tone flips, or a FieldText mounts
	 * where none was showing before, so the control it describes never resizes or shifts underneath it.
	 *
	 * Sizing (00-conventions.md §5.4): max-width var(--mod-7), 224px, so a long message wraps rather
	 * than pushing the module past a grid width. The 8px marker dot is unchanged.
	 */
	export type FieldTextTone = 'help' | 'error';

	export interface Props {
		tone?: FieldTextTone;
		text?: string;
		/** Parent wires this to the control's aria-describedby. Defaulted so the element works alone. */
		id?: string;
	}

	const uid = $props.id();

	let { tone = 'help', text, id = `${uid}-field-text` }: Props = $props();

	const message = $derived(
		text ??
			(tone === 'error'
				? 'Enter a value between 20 and 20000.'
				: 'Applies once you press Enter or move focus away.')
	);
</script>

<p {id} class="field-text" class:tone-error={tone === 'error'}>
	<span class="marker" aria-hidden="true"></span>
	{message}
</p>

<style>
	.field-text {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		margin: 0;
		max-width: var(--mod-7);
		padding: var(--space-1) 0;
		/* Same border width in both tones (transparent for help) — see file header. */
		border: var(--border-width) solid transparent;
		color: var(--color-text-muted);
		font-family: var(--font-sans);
		font-size: var(--font-size-sm);
		font-weight: 400;
		line-height: var(--line-height);
	}

	.marker {
		box-sizing: border-box;
		flex: 0 0 auto;
		width: var(--space-2);
		height: var(--space-2);
		border: var(--border-width) solid transparent;
	}

	.tone-error {
		border-color: var(--color-danger);
		color: var(--color-danger);
		font-weight: 700;
	}

	.tone-error .marker {
		border-color: var(--color-danger);
		background: var(--color-danger);
	}
</style>
