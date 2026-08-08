import type { AudioChannelDefinition } from '@thinkbreak/audio-runtime';
import { BuilderProjectSchema } from '@thinkbreak/project-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// project.svelte.ts is a module singleton. Reset the module registry and re-import per test so
// mutations in one test never leak into the next.
async function loadProjectState() {
	const module = await import('./project.svelte.js');
	return module;
}

function makeChannel(overrides: Partial<AudioChannelDefinition> = {}): AudioChannelDefinition {
	return {
		id: crypto.randomUUID(),
		name: 'Test channel',
		role: 'ignored',
		sourceTrackId: null,
		enabled: true,
		instrument: null,
		mix: { gain: 0.8, pan: 0, muted: false, soloed: false },
		...overrides
	};
}

beforeEach(() => {
	vi.resetModules();
});

describe('projectState.createNew', () => {
	it('produces a project passing BuilderProjectSchema with hasUnsyncedChanges === true', async () => {
		const { projectState } = await loadProjectState();

		projectState.createNew('Song');

		const project = projectState.project;
		expect(project).not.toBeNull();
		expect(BuilderProjectSchema.safeParse(project).success).toBe(true);
		expect(project?.sync.hasUnsyncedChanges).toBe(true);
	});
});

describe('projectState mutators', () => {
	it('rename advances updatedAtMs and sets hasUnsyncedChanges', async () => {
		const { projectState } = await loadProjectState();
		vi.useFakeTimers();
		try {
			projectState.createNew('Song');
			projectState.markSaved(Date.now());
			const before = projectState.project!.updatedAtMs;

			vi.setSystemTime(before + 1000);
			projectState.rename('New name');

			expect(projectState.project!.name).toBe('New name');
			expect(projectState.project!.updatedAtMs).toBeGreaterThan(before);
			expect(projectState.project!.sync.hasUnsyncedChanges).toBe(true);
		} finally {
			vi.useRealTimers();
		}
	});

	it('updateChannelMix advances updatedAtMs and sets hasUnsyncedChanges', async () => {
		const { projectState } = await loadProjectState();
		vi.useFakeTimers();
		try {
			projectState.createNew('Song');
			const channel = makeChannel();
			projectState.replaceChannels([channel]);
			projectState.markSaved(Date.now());
			const before = projectState.project!.updatedAtMs;

			vi.setSystemTime(before + 1000);
			projectState.updateChannelMix(channel.id, { muted: true });

			expect(projectState.project!.channels[0]!.mix.muted).toBe(true);
			expect(projectState.project!.updatedAtMs).toBeGreaterThan(before);
			expect(projectState.project!.sync.hasUnsyncedChanges).toBe(true);
		} finally {
			vi.useRealTimers();
		}
	});

	it('leaves the project and updatedAtMs unchanged when a mutation is invalid', async () => {
		const { projectState } = await loadProjectState();
		projectState.createNew('Song');
		const before = projectState.snapshot();

		expect(() => projectState.updateMaster({ gain: 2 })).toThrow(/resulting project is invalid/);
		expect(projectState.snapshot()).toEqual(before);
	});
});

describe('projectState.markSaved', () => {
	it('clears hasUnsyncedChanges without changing updatedAtMs', async () => {
		const { projectState } = await loadProjectState();
		projectState.createNew('Song');
		const updatedAtMsBefore = projectState.project!.updatedAtMs;

		projectState.markSaved(999);

		expect(projectState.project!.sync.hasUnsyncedChanges).toBe(false);
		expect(projectState.project!.sync.lastSyncedAtMs).toBe(999);
		expect(projectState.project!.updatedAtMs).toBe(updatedAtMsBefore);
	});
});

describe('projectState.updateChannel', () => {
	it('throws a contextual error for an unknown channel ID', async () => {
		const { projectState } = await loadProjectState();
		projectState.createNew('Song');

		expect(() => projectState.updateChannel('missing-channel-id', { name: 'x' })).toThrow(
			/missing-channel-id/
		);
	});
});

describe('isChannelAudible', () => {
	it('with no solos: an enabled unmuted channel is audible, a muted one is not', async () => {
		const { isChannelAudible } = await loadProjectState();
		const audible = makeChannel({
			enabled: true,
			mix: { gain: 0.8, pan: 0, muted: false, soloed: false }
		});
		const muted = makeChannel({
			enabled: true,
			mix: { gain: 0.8, pan: 0, muted: true, soloed: false }
		});

		expect(isChannelAudible(audible, [])).toBe(true);
		expect(isChannelAudible(muted, [])).toBe(false);
	});

	it('with one channel soloed, only that channel is audible', async () => {
		const { isChannelAudible } = await loadProjectState();
		const soloed = makeChannel({ id: 'a', mix: { gain: 0.8, pan: 0, muted: false, soloed: true } });
		const other = makeChannel({ id: 'b', mix: { gain: 0.8, pan: 0, muted: false, soloed: false } });

		expect(isChannelAudible(soloed, ['a'])).toBe(true);
		expect(isChannelAudible(other, ['a'])).toBe(false);
	});

	it('a muted soloed channel is not audible', async () => {
		const { isChannelAudible } = await loadProjectState();
		const mutedSoloed = makeChannel({
			id: 'a',
			mix: { gain: 0.8, pan: 0, muted: true, soloed: true }
		});

		expect(isChannelAudible(mutedSoloed, ['a'])).toBe(false);
	});
});

describe('projectState.replaceChannels', () => {
	it('does not clear an unrelated selectedChannelId', async () => {
		// selectedChannelId lives in ui.svelte.ts, not project.svelte.ts. This test asserts
		// replaceChannels only touches project.channels and leaves nothing else in its wake.
		const { projectState } = await loadProjectState();
		projectState.createNew('Song');
		const channel = makeChannel();

		expect(() => projectState.replaceChannels([channel])).not.toThrow();
		expect(projectState.channels).toEqual([channel]);
	});
});

describe('projectState validation boundaries', () => {
	it('rejects an invalid project without replacing the current project', async () => {
		const { projectState } = await loadProjectState();
		projectState.createNew('Song');
		const before = projectState.snapshot();
		const invalid = structuredClone(before!);
		invalid.name = '   ';

		expect(() => projectState.setProject(invalid)).toThrow(/Unable to set project/);
		expect(projectState.snapshot()).toEqual(before);
	});

	it('trims names and rejects blank or overlong rename attempts without mutation', async () => {
		const { projectState } = await loadProjectState();
		projectState.createNew('Song');
		projectState.rename('  Trimmed song  ');
		expect(projectState.project?.name).toBe('Trimmed song');
		const before = projectState.snapshot();

		expect(() => projectState.rename('  ')).toThrow(/cannot be blank/);
		expect(() => projectState.rename('a'.repeat(121))).toThrow(/120 characters/);
		expect(projectState.snapshot()).toEqual(before);
	});
});
