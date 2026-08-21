<script lang="ts">
	import { tick, type Component } from 'svelte';
	import PulseIcon from './icons/PulseIcon.svelte';
	import SawIcon from './icons/SawIcon.svelte';
	import SineIcon from './icons/SineIcon.svelte';
	import SquareIcon from './icons/SquareIcon.svelte';
	import TriangleIcon from './icons/TriangleIcon.svelte';

	export interface SelectorOption {
		value: string;
		label: string;
		icon: Component;
	}

	interface Props {
		label?: string;
		options?: SelectorOption[];
		selection?: string;
		hideActiveName?: boolean;
	}

	const DEFAULT_OPTIONS: SelectorOption[] = [
		{ value: 'sine', label: 'Sine', icon: SineIcon },
		{ value: 'triangle', label: 'Triangle', icon: TriangleIcon },
		{ value: 'square', label: 'Square', icon: SquareIcon },
		{ value: 'saw', label: 'Saw', icon: SawIcon },
		{ value: 'pulse', label: 'Pulse', icon: PulseIcon }
	];

	let {
		label = 'Wave',
		options = DEFAULT_OPTIONS,
		selection = $bindable(options[0]?.value ?? ''),
		hideActiveName = false
	}: Props = $props();

	const uid = $props.id();
	const labelId = `${uid}-label`;
	const buttonId = `${uid}-button`;
	const listboxId = `${uid}-listbox`;

	let open = $state(false);
	let activeIndex = $state(0);
	let wrapper = $state<HTMLDivElement>();
	let listbox = $state<HTMLDivElement>();
	let typeahead = '';
	let typeaheadTimer: ReturnType<typeof setTimeout> | undefined;

	const selectedIndex = $derived(
		Math.max(
			0,
			options.findIndex((option) => option.value === selection)
		)
	);
	const selectedOption = $derived(options[selectedIndex]);

	function optionId(index: number): string {
		return `${uid}-option-${index}`;
	}

	async function focusOption(index: number) {
		await tick();
		listbox?.querySelector<HTMLElement>(`[data-option-index="${index}"]`)?.focus();
	}

	async function openListbox() {
		if (options.length === 0) return;
		activeIndex = selectedIndex;
		open = true;
		await focusOption(activeIndex);
	}

	function closeListbox(returnFocus = false) {
		open = false;
		if (returnFocus) {
			void tick().then(() => document.getElementById(buttonId)?.focus());
		}
	}

	function choose(index: number, close = false) {
		const option = options[index];
		if (!option) return;
		selection = option.value;
		activeIndex = index;
		if (close) closeListbox(true);
	}

	function move(step: number, close = false) {
		if (options.length === 0) return;
		const origin = open ? activeIndex : selectedIndex;
		const next = (origin + step + options.length) % options.length;
		choose(next, close);
		if (open) void focusOption(next);
	}

	function jump(index: number) {
		choose(index);
		if (open) void focusOption(index);
	}

	function runTypeahead(key: string) {
		const nextCharacter = key.toLocaleLowerCase();
		const repeatedCharacter =
			typeahead.length > 0 && [...typeahead].every((part) => part === nextCharacter);
		typeahead = repeatedCharacter ? nextCharacter : typeahead + nextCharacter;
		if (typeaheadTimer) clearTimeout(typeaheadTimer);
		typeaheadTimer = setTimeout(() => (typeahead = ''), 500);

		const origin = open ? activeIndex : selectedIndex;
		const searchOrder = options.map((_, offset) => (origin + offset + 1) % options.length);
		const match = searchOrder.find((index) =>
			options[index]?.label.toLocaleLowerCase().startsWith(typeahead)
		);
		if (match !== undefined) jump(match);
	}

	function handleButtonKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			move(1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			move(-1);
		} else if (event.key === 'Home') {
			event.preventDefault();
			jump(0);
		} else if (event.key === 'End') {
			event.preventDefault();
			jump(options.length - 1);
		} else if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			void openListbox();
		} else if (event.key === 'Escape') {
			closeListbox();
		} else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
			runTypeahead(event.key);
		}
	}

	function handleListboxKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			move(1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			move(-1);
		} else if (event.key === 'Home') {
			event.preventDefault();
			jump(0);
		} else if (event.key === 'End') {
			event.preventDefault();
			jump(options.length - 1);
		} else if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			choose(activeIndex, true);
		} else if (event.key === 'Escape') {
			closeListbox(true);
		} else if (event.key === 'Tab') {
			setTimeout(() => closeListbox());
		} else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
			runTypeahead(event.key);
		}
	}

	function handleFocusout() {
		setTimeout(() => {
			if (!wrapper?.contains(document.activeElement)) closeListbox();
		});
	}

	function handleWindowClick(event: MouseEvent) {
		if (open && event.target instanceof Node && !wrapper?.contains(event.target)) closeListbox();
	}
</script>

<svelte:window onclick={handleWindowClick} />

<div
	class="selector-switch"
	class:active-name-hidden={hideActiveName}
	bind:this={wrapper}
	onfocusout={handleFocusout}
>
	<span class="spacer" aria-hidden="true"></span>
	<div class="control-row">
		<span class="label" id={labelId}>{label}</span>
		<div class="control">
			<button
				id={buttonId}
				type="button"
				class="trigger"
				aria-labelledby={`${labelId} ${buttonId}-value`}
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-controls={listboxId}
				onclick={() => (open ? closeListbox() : void openListbox())}
				onkeydown={handleButtonKeydown}
			>
				<span id={`${buttonId}-value`} class="visually-hidden">{selectedOption?.label}</span>
				{#if selectedOption}
					{@const SelectedIcon = selectedOption.icon}
					<SelectedIcon />
				{/if}
			</button>

			{#if open}
				<div
					id={listboxId}
					class="listbox"
					role="listbox"
					tabindex="-1"
					aria-labelledby={labelId}
					bind:this={listbox}
				>
					{#each options as option, index (option.value)}
						{@const OptionIcon = option.icon}
						<div
							id={optionId(index)}
							class="option"
							class:active={index === activeIndex}
							role="option"
							aria-selected={option.value === selection}
							tabindex={index === activeIndex ? 0 : -1}
							data-option-index={index}
							onclick={() => choose(index, true)}
							onkeydown={handleListboxKeydown}
							onmouseenter={() => (activeIndex = index)}
						>
							<OptionIcon />
							<span>{option.label}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
	{#if !hideActiveName}
		<span class="active-name">{selectedOption?.label}</span>
	{/if}
</div>

<style>
	.selector-switch {
		box-sizing: border-box;
		position: relative;
		display: flex;
		flex-direction: column;
		width: var(--mod-2);
		height: var(--band-2);
		color: var(--color-text);
		font-size: var(--font-size-sm);
	}

	.selector-switch.active-name-hidden {
		height: calc(var(--band-2) - var(--label-line));
	}

	.spacer,
	.active-name {
		box-sizing: border-box;
		height: var(--label-line);
	}

	.control-row {
		display: flex;
		align-items: center;
		height: var(--band-1);
	}

	.label,
	.control {
		box-sizing: border-box;
		width: var(--mod-1);
	}

	.label {
		overflow: hidden;
		line-height: var(--label-line);
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.control {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		height: var(--band-1);
		padding-block: var(--pad-1);
	}

	.trigger {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--mod-1);
		height: var(--segment-height);
		padding: 0 var(--pad-1);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-background);
		color: var(--color-text);
		cursor: pointer;
	}

	.trigger:hover,
	.option:hover,
	.option.active {
		background: var(--color-surface-active);
	}

	.trigger:focus-visible,
	.option:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	.active-name {
		overflow: hidden;
		color: var(--color-text);
		line-height: var(--readout-line);
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.listbox {
		position: absolute;
		top: calc(-1 * var(--label-line));
		left: 0;
		z-index: 3;
		box-sizing: border-box;
		display: grid;
		grid-template-columns: repeat(2, var(--mod-3));
		width: var(--mod-6);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-background);
	}

	.option {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		gap: var(--pad-2);
		height: var(--band-1);
		padding: 0 var(--pad-2);
		color: var(--color-text);
		cursor: pointer;
	}

	.option[aria-selected='true'] {
		font-weight: 700;
	}

	.trigger :global(svg),
	.option :global(svg) {
		flex: none;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
