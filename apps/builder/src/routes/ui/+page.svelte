<script lang="ts">
	import type { Component } from 'svelte';
	import { UI_ELEMENT_CATALOG } from './catalog.js';
	import AdvancedDrawer from './elements/AdvancedDrawer.svelte';
	import ChannelStrip from './elements/ChannelStrip.svelte';
	import ControlSection from './elements/ControlSection.svelte';
	import Dialog from './elements/Dialog.svelte';
	import DualRotaryPot from './elements/DualRotaryPot.svelte';
	import EmptyState from './elements/EmptyState.svelte';
	import EngineStatus from './elements/EngineStatus.svelte';
	import FieldText from './elements/FieldText.svelte';
	import InstrumentChannelMockup from './elements/InstrumentChannelMockup.svelte';
	import LevelMeter from './elements/LevelMeter.svelte';
	import LinearPot from './elements/LinearPot.svelte';
	import RotaryPot from './elements/RotaryPot.svelte';
	import ScrubSlider from './elements/ScrubSlider.svelte';
	import SegmentSwitch from './elements/SegmentSwitch.svelte';
	import LatchingSwitch from './elements/LatchingSwitch.svelte';
	import MasterStrip from './elements/MasterStrip.svelte';
	import MomentaryButton from './elements/MomentaryButton.svelte';
	import PatchBrowser from './elements/PatchBrowser.svelte';
	import PatchHeader from './elements/PatchHeader.svelte';
	import SelectorSwitch from './elements/SelectorSwitch.svelte';
	import SoundSetPanel from './elements/SoundSetPanel.svelte';
	import StatusRegion from './elements/StatusRegion.svelte';
	import StepButton from './elements/StepButton.svelte';
	import StripRail from './elements/StripRail.svelte';
	import TextEntry from './elements/TextEntry.svelte';
	import ToggleSwitch from './elements/ToggleSwitch.svelte';
	import UnassignedList from './elements/UnassignedList.svelte';
	import ValueReadout from './elements/ValueReadout.svelte';
	import ViewSelector from './elements/ViewSelector.svelte';

	// Slots stay empty until a specimen exists for that row; the box is the design placeholder.
	const SPECIMENS: Record<string, Component> = {
		'rotary-pot': RotaryPot,
		'dual-rotary-pot': DualRotaryPot,
		'linear-pot': LinearPot,
		'scrub-slider': ScrubSlider,
		'segment-switch': SegmentSwitch,
		'toggle-switch': ToggleSwitch,
		'selector-switch': SelectorSwitch,
		'latching-switch': LatchingSwitch,
		'text-entry': TextEntry,
		'momentary-button': MomentaryButton,
		'step-button': StepButton,
		'control-section': ControlSection,
		'view-selector': ViewSelector,
		'patch-header': PatchHeader,
		'channel-strip': ChannelStrip,
		'master-strip': MasterStrip,
		'strip-rail': StripRail,
		'unassigned-list': UnassignedList,
		'advanced-drawer': AdvancedDrawer,
		dialog: Dialog,
		'patch-browser': PatchBrowser,
		'sound-set-panel': SoundSetPanel,
		'level-meter': LevelMeter,
		'value-readout': ValueReadout,
		'field-text': FieldText,
		'engine-status': EngineStatus,
		'status-region': StatusRegion,
		'empty-state': EmptyState
	};
</script>

<svelte:head>
	<title>UI element catalog</title>
</svelte:head>

<div class="scroll">
	<table>
		<thead>
			<tr>
				<th scope="col" class="slot-head">Component</th>
				<th scope="col" class="name-head">Name</th>
				<th scope="col">Instrument</th>
				<th scope="col">Mixer</th>
				<th scope="col">Transport</th>
				<th scope="col" class="spec-head">Spec / recommendation</th>
			</tr>
		</thead>
		{#each UI_ELEMENT_CATALOG as group (group.id)}
			<tbody>
				<tr class="group">
					<th scope="colgroup" colspan="6">{group.title}</th>
				</tr>
				{#each group.rows as row (row.slug)}
					<tr>
						<td class="slot">
							<div class="slot-box" data-slot={row.slug}>
								{#if SPECIMENS[row.slug] !== undefined}
									{@const Specimen = SPECIMENS[row.slug]}
									<Specimen />
								{/if}
							</div>
						</td>
						<th scope="row" class="name">
							<span class="element-name">{row.name}</span>
							<span class="file">{row.file}</span>
						</th>
						<td>
							{#if row.instrument.length === 0}
								<span class="none">—</span>
							{:else}
								<ul>
									{#each row.instrument as use (use)}
										<li>{use}</li>
									{/each}
								</ul>
							{/if}
						</td>
						<td>
							{#if row.mixer.length === 0}
								<span class="none">—</span>
							{:else}
								<ul>
									{#each row.mixer as use (use)}
										<li>{use}</li>
									{/each}
								</ul>
							{/if}
						</td>
						<td>
							{#if row.transport.length === 0}
								<span class="none">—</span>
							{:else}
								<ul>
									{#each row.transport as use (use)}
										<li>{use}</li>
									{/each}
								</ul>
							{/if}
						</td>
						<td class="spec">
							<span class="source">{row.source}</span>
							<span class="guidance">{row.guidance}</span>
							{#if row.variants !== undefined}
								<span class="variants-label">Also covers</span>
								<ul>
									{#each row.variants as variant (variant)}
										<li>{variant}</li>
									{/each}
								</ul>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		{/each}
	</table>

	<section class="instrument-preview" aria-labelledby="instrument-preview-title">
		<div class="preview-heading">
			<p>Composed view</p>
			<h1 id="instrument-preview-title">Instrument pane mockup</h1>
		</div>
		<InstrumentChannelMockup />
	</section>
</div>

<style>
	.scroll {
		height: 100%;
		overflow: auto;
		background: var(--color-background);
	}

	table {
		min-width: 1200px;
		border-collapse: collapse;
		font-size: var(--font-size-sm);
	}

	th,
	td {
		padding: var(--space-2);
		border: var(--border-width) solid var(--color-border);
		text-align: left;
		vertical-align: top;
	}

	thead th {
		position: sticky;
		top: 0;
		z-index: 1;
		border-bottom-color: var(--color-border-strong);
		background: var(--color-surface);
		font-weight: 700;
	}

	.slot-head {
		width: 140px;
	}

	.name-head {
		width: 180px;
	}

	.spec-head {
		width: 34%;
	}

	.group th {
		border-color: var(--color-border-strong);
		background: var(--color-surface-active);
		font-size: var(--font-size-base);
		font-weight: 700;
	}

	.slot {
		padding: var(--space-1);
	}

	.slot-box {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 120px;
		min-height: 96px;
		padding: var(--space-2);
		border: var(--border-width) solid var(--color-border-strong);
		border-radius: var(--radius);
		background: var(--color-background);
	}

	.name {
		font-weight: 400;
	}

	.element-name {
		display: block;
		font-family: var(--font-mono);
		font-weight: 700;
	}

	.file {
		display: block;
		margin-top: var(--space-1);
		font-family: var(--font-mono);
		color: var(--color-text-muted);
		overflow-wrap: anywhere;
	}

	ul {
		margin: 0;
		padding-left: var(--space-4);
	}

	li {
		margin-bottom: var(--space-1);
	}

	.none {
		color: var(--color-text-muted);
	}

	.source {
		display: block;
		margin-bottom: var(--space-1);
		font-family: var(--font-mono);
		color: var(--color-text-muted);
	}

	.guidance {
		display: block;
	}

	.variants-label {
		display: block;
		margin: var(--space-2) 0 var(--space-1);
		color: var(--color-text-muted);
		font-weight: 700;
	}

	.instrument-preview {
		min-width: 1200px;
		padding: var(--space-6) var(--space-4);
		border-top: var(--border-width) solid var(--color-border-strong);
	}

	.preview-heading {
		margin-bottom: var(--space-3);
	}
	.preview-heading p {
		margin: 0 0 var(--space-1);
		color: var(--color-text-muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
	}
	.preview-heading h1 {
		margin: 0;
		font-size: var(--font-size-lg);
	}
</style>
