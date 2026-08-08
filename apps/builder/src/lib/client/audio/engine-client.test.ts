import {
	createDefaultPercussionInstrument,
	createDefaultPitchedInstrument,
	PlaybackError,
	type AudioChannelDefinition,
	type AudioEngine,
	type BuilderProject,
	type PreviewHandle
} from '@thinkbreak/audio-runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface EngineSpies {
	initialize: ReturnType<typeof vi.fn>;
	resumeAudioContext: ReturnType<typeof vi.fn>;
	loadProject: ReturnType<typeof vi.fn>;
	setChannelInstrument: ReturnType<typeof vi.fn>;
	beginPreview: ReturnType<typeof vi.fn>;
	dispose: ReturnType<typeof vi.fn>;
}

function createFakeEngine(overrides: Partial<EngineSpies> = {}): {
	engine: AudioEngine;
	spies: EngineSpies;
} {
	const spies: EngineSpies = {
		initialize: vi.fn().mockResolvedValue(undefined),
		resumeAudioContext: vi.fn().mockResolvedValue(undefined),
		loadProject: vi.fn(),
		setChannelInstrument: vi.fn(),
		beginPreview: vi
			.fn()
			.mockReturnValue({ release: vi.fn(), stop: vi.fn() } satisfies PreviewHandle),
		dispose: vi.fn(),
		...overrides
	};
	const engine = {
		...spies,
		audioContextStatus: 'running',
		lastPlaybackError: null,
		onAudioContextStatusChange: vi.fn().mockReturnValue(() => undefined),
		onPlaybackError: vi.fn().mockReturnValue(() => undefined),
		suspendAudioContext: vi.fn().mockResolvedValue(undefined),
		play: vi.fn(),
		pause: vi.fn(),
		stop: vi.fn(),
		seekToSeconds: vi.fn(),
		seekToTicks: vi.fn(),
		setLoopEnabled: vi.fn(),
		setLoopRegion: vi.fn(),
		setTempoMultiplier: vi.fn(),
		setMasterVolume: vi.fn(),
		setMasterCompressor: vi.fn(),
		setChannelVolume: vi.fn(),
		setChannelPan: vi.fn(),
		setChannelMuted: vi.fn(),
		setChannelSoloed: vi.fn(),
		setChannelEnabled: vi.fn(),
		triggerPreview: vi.fn(),
		status: 'stopped',
		positionSeconds: 0,
		positionTicks: 0,
		durationSeconds: 0,
		durationTicks: 0,
		activeVoiceCount: 0,
		readChannelLevel: vi.fn().mockReturnValue(0),
		readMasterLevel: vi.fn().mockReturnValue(0)
	} as unknown as AudioEngine;
	return { engine, spies };
}

function makeSong(trackId: string) {
	return {
		schemaVersion: 1,
		id: crypto.randomUUID(),
		sourceFilename: 'preview.mid',
		ticksPerQuarterNote: 480,
		durationTicks: 480,
		tempoChanges: [{ tick: 0, bpm: 120 }],
		timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
		markers: [],
		tracks: [
			{
				id: trackId,
				sourceTrackName: 'Lead',
				midiChannel: 0,
				notes: [],
				pitchBends: [],
				modulationEvents: [],
				volumeEvents: []
			}
		]
	};
}

function makeChannel(role: 'pitched' | 'percussion'): AudioChannelDefinition {
	return {
		id: crypto.randomUUID(),
		name: role === 'pitched' ? 'Lead' : 'Drums',
		role,
		sourceTrackId: crypto.randomUUID(),
		enabled: true,
		instrument:
			role === 'pitched' ? createDefaultPitchedInstrument() : createDefaultPercussionInstrument(),
		mix: { gain: 0.8, pan: 0, muted: false, soloed: false }
	};
}

async function loadModules() {
	const [clientModule, projectModule, statusModule, playbackModule] = await Promise.all([
		import('./engine-client.js'),
		import('$lib/state/project.svelte.js'),
		import('$lib/state/status.svelte.js'),
		import('$lib/state/playback.svelte.js')
	]);
	return { ...clientModule, ...projectModule, ...statusModule, ...playbackModule };
}

async function installProject(channel: AudioChannelDefinition): Promise<AudioChannelDefinition> {
	const { projectState } = await import('$lib/state/project.svelte.js');
	projectState.createNew('Audio test');
	const project = projectState.snapshot()!;
	project.song = makeSong(channel.sourceTrackId!);
	project.channels = [channel];
	projectState.setProject(project as BuilderProject);
	return channel;
}

beforeEach(() => {
	vi.resetModules();
});

describe('engine client initialization', () => {
	it('deduplicates concurrent initialization and loads the current project after success', async () => {
		const { createEngineClient } = await loadModules();
		await installProject(makeChannel('pitched'));
		const deferred = Promise.withResolvers<void>();
		const fake = createFakeEngine({ initialize: vi.fn().mockReturnValue(deferred.promise) });
		const factory = vi.fn().mockReturnValue(fake.engine);
		const client = createEngineClient({ createEngine: factory, isBrowser: () => true });

		const first = client.ensureInitialized();
		const second = client.ensureInitialized();
		expect(factory).toHaveBeenCalledTimes(1);
		deferred.resolve();
		await expect(first).resolves.toBe(fake.engine);
		await expect(second).resolves.toBe(fake.engine);
		expect(fake.spies.loadProject).toHaveBeenCalledTimes(1);
		expect(client.engine).toBe(fake.engine);
	});

	it('reports a failed initialization, keeps edits available, and retries with a fresh engine', async () => {
		const { createEngineClient, statusState, playbackState } = await loadModules();
		const failed = createFakeEngine({
			initialize: vi.fn().mockRejectedValue(new Error('permission denied'))
		});
		const successful = createFakeEngine();
		const factory = vi
			.fn()
			.mockReturnValueOnce(failed.engine)
			.mockReturnValueOnce(successful.engine);
		const client = createEngineClient({ createEngine: factory, isBrowser: () => true });

		await expect(client.ensureInitialized()).resolves.toBeNull();
		expect(client.isInitialized).toBe(false);
		expect(playbackState.audioContextStatus).toBe('failed');
		expect(statusState.latestMessage?.text).toContain('Unable to initialize audio');
		await expect(client.ensureInitialized()).resolves.toBe(successful.engine);
		expect(factory).toHaveBeenCalledTimes(2);
	});

	it('resumes through the public runtime API and dispose resets client ownership idempotently', async () => {
		const { createEngineClient } = await loadModules();
		const fake = createFakeEngine();
		const client = createEngineClient({ createEngine: () => fake.engine, isBrowser: () => true });

		await expect(client.resumeAudio()).resolves.toBe(fake.engine);
		expect(fake.spies.resumeAudioContext).toHaveBeenCalledTimes(1);
		client.dispose();
		client.dispose();
		expect(fake.spies.dispose).toHaveBeenCalledTimes(1);
		expect(client.engine).toBeNull();
	});

	it('reports a resume rejection without throwing', async () => {
		const { createEngineClient, playbackState, statusState } = await loadModules();
		const fake = createFakeEngine({
			resumeAudioContext: vi.fn().mockRejectedValue(new Error('gesture rejected'))
		});
		const client = createEngineClient({ createEngine: () => fake.engine, isBrowser: () => true });

		await expect(client.resumeAudio()).resolves.toBeNull();
		expect(playbackState.audioContextStatus).toBe('failed');
		expect(statusState.latestMessage?.text).toContain('Unable to resume audio');
	});

	it('does not resurrect an engine disposed while initialization is pending', async () => {
		const { createEngineClient } = await loadModules();
		const deferred = Promise.withResolvers<void>();
		const fake = createFakeEngine({ initialize: vi.fn().mockReturnValue(deferred.promise) });
		const client = createEngineClient({ createEngine: () => fake.engine, isBrowser: () => true });

		const initialization = client.ensureInitialized();
		client.dispose();
		deferred.resolve();
		await expect(initialization).resolves.toBeNull();
		expect(client.engine).toBeNull();
		// The runtime contract makes repeated disposal safe; the client may defensively dispose the
		// in-flight engine before its initialization continuation observes cancellation.
		expect(fake.spies.dispose).toHaveBeenCalled();
	});
});

describe('engine client synchronization and preview', () => {
	it('uses full-project loading only for structural synchronization and pushes one channel instrument otherwise', async () => {
		const { createEngineClient } = await loadModules();
		const channel = await installProject(makeChannel('pitched'));
		const fake = createFakeEngine();
		const client = createEngineClient({ createEngine: () => fake.engine, isBrowser: () => true });
		await client.ensureInitialized();
		fake.spies.loadProject.mockClear();

		client.syncChannel(channel.id);
		expect(fake.spies.setChannelInstrument).toHaveBeenCalledWith(channel.id, channel.instrument);
		expect(fake.spies.loadProject).not.toHaveBeenCalled();
		client.syncProject();
		expect(fake.spies.loadProject).toHaveBeenCalledTimes(1);
	});

	it('disposes a loaded engine when the current project no longer has a song', async () => {
		const { createEngineClient, projectState } = await loadModules();
		const channel = await installProject(makeChannel('pitched'));
		const fake = createFakeEngine();
		const client = createEngineClient({ createEngine: () => fake.engine, isBrowser: () => true });
		await client.ensureInitialized();
		projectState.setProject(null);

		client.syncProject();
		expect(fake.spies.dispose).toHaveBeenCalledTimes(1);
		expect(client.engine).toBeNull();
		expect(channel.id).toBeTruthy();
	});

	it('uses musician-appropriate preview defaults and handles PlaybackError-like failures safely', async () => {
		const { createEngineClient, statusState } = await loadModules();
		const pitched = await installProject(makeChannel('pitched'));
		const fake = createFakeEngine();
		const client = createEngineClient({ createEngine: () => fake.engine, isBrowser: () => true });

		await expect(client.beginPreview(pitched.id)).resolves.not.toBeNull();
		expect(fake.spies.beginPreview).toHaveBeenLastCalledWith(pitched.id, 60, 0.9);

		const percussion = { ...makeChannel('percussion'), sourceTrackId: pitched.sourceTrackId };
		const { projectState } = await import('$lib/state/project.svelte.js');
		projectState.replaceChannels([percussion]);
		client.syncProject();
		await client.beginPreview(percussion.id);
		expect(fake.spies.beginPreview).toHaveBeenLastCalledWith(percussion.id, 36, 0.9);

		fake.spies.beginPreview.mockImplementationOnce(() => {
			throw new PlaybackError('preview graph missing');
		});
		await expect(client.beginPreview(percussion.id)).resolves.toBeNull();
		expect(statusState.latestMessage?.text).toContain('Unable to preview channel');
	});
});
