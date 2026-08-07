<script lang="ts">
	import Panel from '$lib/components/Panel.svelte';
	import { projectState } from '$lib/state/project.svelte.js';
	import { formatSongDuration } from './format-song-duration.js';
	import ImportWarningList from './ImportWarningList.svelte';

	const song = $derived(projectState.project?.song ?? null);
	const sourceMidi = $derived(projectState.project?.sourceMidi ?? null);

	const noteCount = $derived(
		song === null ? 0 : song.tracks.reduce((total, track) => total + track.notes.length, 0)
	);
	const fileSizeKb = $derived(
		sourceMidi === null ? null : (sourceMidi.byteLength / 1024).toFixed(1)
	);
	const initialTempoBpm = $derived(song?.tempoChanges[0]?.bpm ?? null);
	const initialTimeSignature = $derived(
		song?.timeSignatures[0]
			? `${song.timeSignatures[0].numerator}/${song.timeSignatures[0].denominator}`
			: null
	);
</script>

{#if song !== null}
	<Panel title="Import summary" class="import-summary">
		<dl>
			<div class="row">
				<dt>Source file</dt>
				<dd>{sourceMidi?.filename ?? song.sourceFilename}</dd>
			</div>
			<div class="row">
				<dt>File size</dt>
				<dd>{fileSizeKb === null ? '—' : `${fileSizeKb} KB`}</dd>
			</div>
			<div class="row">
				<dt>Tracks</dt>
				<dd>{song.tracks.length}</dd>
			</div>
			<div class="row">
				<dt>Notes</dt>
				<dd>{noteCount}</dd>
			</div>
			<div class="row">
				<dt>Ticks per quarter note</dt>
				<dd>{song.ticksPerQuarterNote}</dd>
			</div>
			<div class="row">
				<dt>Duration</dt>
				<dd>{formatSongDuration(song)}</dd>
			</div>
			<div class="row">
				<dt>Initial tempo</dt>
				<dd>{initialTempoBpm === null ? '—' : `${initialTempoBpm} BPM`}</dd>
			</div>
			<div class="row">
				<dt>Tempo changes</dt>
				<dd>{song.tempoChanges.length}</dd>
			</div>
			<div class="row">
				<dt>Initial time signature</dt>
				<dd>{initialTimeSignature ?? '—'}</dd>
			</div>
			<div class="row">
				<dt>Markers</dt>
				<dd>{song.markers.length}</dd>
			</div>
		</dl>
		<ImportWarningList />
	</Panel>
{/if}

<style>
	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		row-gap: var(--space-1);
		column-gap: var(--space-3);
		margin: 0;
	}

	.row {
		display: contents;
	}

	dt {
		color: var(--color-text-muted);
	}

	dd {
		margin: 0;
		color: var(--color-text);
	}
</style>
