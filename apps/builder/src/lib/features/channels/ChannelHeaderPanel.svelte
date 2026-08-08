<script lang="ts">
	import type { ChannelRole } from '@thinkbreak/audio-runtime';
	import { DEFAULT_CHANNEL_MIX } from '@thinkbreak/audio-runtime';
	import Button from '$lib/components/Button.svelte';
	import CheckboxField from '$lib/components/CheckboxField.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import Panel from '$lib/components/Panel.svelte';
	import SelectField from '$lib/components/SelectField.svelte';
	import TextField from '$lib/components/TextField.svelte';
	import { instrumentForRoleChange } from '$lib/features/channels/channel-assignment.js';
	import { projectState } from '$lib/state/project.svelte.js';
	import { uiState } from '$lib/state/ui.svelte.js';

	const NAME_MAX_LENGTH = 120;

	const ROLE_OPTIONS: { value: ChannelRole; label: string }[] = [
		{ value: 'pitched', label: 'Pitched' },
		{ value: 'percussion', label: 'Percussion' },
		{ value: 'ignored', label: 'Ignored' },
		{ value: 'metadata', label: 'Metadata' }
	];

	const channel = $derived(
		projectState.channels.find((candidate) => candidate.id === uiState.selectedChannelId) ?? null
	);
	const sourceTrack = $derived(
		channel === null
			? null
			: (projectState.project?.song?.tracks.find((track) => track.id === channel.sourceTrackId) ??
					null)
	);

	let nameDraft = $state('');
	let nameError = $state('');
	let lastSelectedChannelId: string | null = null;
	let resetDialogOpen = $state(false);

	$effect(() => {
		if (uiState.selectedChannelId === lastSelectedChannelId) return;
		lastSelectedChannelId = uiState.selectedChannelId;
		nameDraft = channel?.name ?? '';
		nameError = '';
	});

	function commitName() {
		if (channel === null) return;
		const trimmed = nameDraft.trim();
		if (trimmed === '') {
			nameDraft = channel.name;
			nameError = 'Name cannot be empty.';
			return;
		}
		nameError = '';
		if (trimmed === channel.name) return;
		projectState.updateChannel(channel.id, { name: trimmed });
	}

	// TextField has no onkeydown prop, so Enter-to-commit is wired with an action instead of an
	// inline handler on the wrapping element (which would trip the static-element-interactions
	// a11y check for no reason — the input itself is already a real interactive control).
	function commitOnEnter(node: HTMLElement) {
		function handleKeydown(event: KeyboardEvent) {
			if (event.key !== 'Enter') return;
			commitName();
		}
		node.addEventListener('keydown', handleKeydown);
		return {
			destroy() {
				node.removeEventListener('keydown', handleKeydown);
			}
		};
	}

	function handleRoleChange(event: Event) {
		if (channel === null) return;
		const role = (event.target as HTMLSelectElement).value as ChannelRole;
		const instrument = instrumentForRoleChange({
			currentRole: channel.role,
			nextRole: role,
			currentInstrument: channel.instrument
		});
		projectState.updateChannel(channel.id, { role, instrument });
	}

	function handleEnabledChange(event: Event) {
		if (channel === null) return;
		const enabled = (event.target as HTMLInputElement).checked;
		projectState.updateChannel(channel.id, { enabled });
	}

	function handleReset() {
		if (channel === null) return;
		const revertedName = sourceTrack?.sourceTrackName ?? channel.name;
		projectState.updateChannelMix(channel.id, { ...DEFAULT_CHANNEL_MIX });
		projectState.updateChannel(channel.id, { name: revertedName });
		nameDraft = revertedName;
		nameError = '';
	}
</script>

{#if channel !== null}
	<Panel title="Channel" class="channel-header-panel">
		<div class="fields">
			<div class="name-field" use:commitOnEnter>
				<TextField
					label="Name"
					id="channel-name"
					bind:value={nameDraft}
					maxlength={NAME_MAX_LENGTH}
					error={nameError || undefined}
					onchange={commitName}
				/>
			</div>
			<SelectField
				label="Role"
				id="channel-role"
				value={channel.role}
				options={ROLE_OPTIONS}
				onchange={handleRoleChange}
			/>
			<CheckboxField
				label="Enabled"
				id="channel-enabled"
				checked={channel.enabled}
				onchange={handleEnabledChange}
			/>
		</div>

		<dl class="source-track">
			<div class="row">
				<dt>Source track</dt>
				<dd>{sourceTrack?.sourceTrackName ?? 'No matching MIDI track.'}</dd>
			</div>
			<div class="row">
				<dt>MIDI channel</dt>
				<dd>{sourceTrack ? sourceTrack.midiChannel : '—'}</dd>
			</div>
			<div class="row">
				<dt>Notes</dt>
				<dd>{sourceTrack ? sourceTrack.notes.length : '—'}</dd>
			</div>
		</dl>

		<div class="actions">
			<Button variant="danger" onclick={() => (resetDialogOpen = true)}>Reset channel</Button>
		</div>
	</Panel>

	<ConfirmDialog
		bind:open={resetDialogOpen}
		title="Reset channel"
		message="This resets the mix (gain, pan, mute, solo) and renames the channel back to its source track name. It does not change the instrument."
		confirmLabel="Reset channel"
		onconfirm={handleReset}
	/>
{/if}

<style>
	:global(.channel-header-panel) {
		margin-bottom: var(--space-3);
	}

	.fields {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--space-3);
	}

	.name-field {
		min-width: 200px;
	}

	.source-track {
		display: grid;
		grid-template-columns: max-content 1fr;
		row-gap: var(--space-1);
		column-gap: var(--space-3);
		margin: var(--space-3) 0 0;
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

	.actions {
		margin-top: var(--space-3);
	}
</style>
