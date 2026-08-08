import {
	createAudioEngine,
	PlaybackError,
	type AudioEngine,
	type AudioContextStatus as EngineAudioContextStatus,
	type PreviewHandle
} from '@thinkbreak/audio-runtime';
import { playbackState } from '$lib/state/playback.svelte.js';
import { projectState } from '$lib/state/project.svelte.js';
import { statusState } from '$lib/state/status.svelte.js';

export interface EngineClientOptions {
	createEngine?: () => AudioEngine;
	isBrowser?: () => boolean;
}

/**
 * Builder's sole lazy AudioEngine owner. It deliberately creates no Web Audio objects until a
 * gesture calls ensureInitialized or resumeAudio, so importing Builder state remains SSR-safe.
 */
export function createEngineClient(options: EngineClientOptions = {}) {
	const createEngine = options.createEngine ?? createAudioEngine;
	const isBrowser = options.isBrowser ?? (() => typeof window !== 'undefined');
	let engine: AudioEngine | null = null;
	let pendingEngine: AudioEngine | null = null;
	let initializePromise: Promise<AudioEngine | null> | null = null;
	let unsubscribeAudioContextStatus: (() => void) | null = null;
	let unsubscribePlaybackError: (() => void) | null = null;
	let ownershipGeneration = 0;
	let initializationSequence = 0;

	function reportAudioFailure(action: string, error: unknown): void {
		const detail = error instanceof Error ? error.message : String(error);
		statusState.push('error', `Unable to ${action}: ${detail}`);
	}

	function bindEngineEvents(nextEngine: AudioEngine): void {
		unsubscribeAudioContextStatus = nextEngine.onAudioContextStatusChange((status) => {
			setPlaybackAudioContextStatus(status);
		});
		unsubscribePlaybackError = nextEngine.onPlaybackError((error) => {
			statusState.push('error', `Audio playback failed: ${error.message}`);
		});
		setPlaybackAudioContextStatus(nextEngine.audioContextStatus);
	}

	function releaseEngineOwnership(): void {
		unsubscribeAudioContextStatus?.();
		unsubscribeAudioContextStatus = null;
		unsubscribePlaybackError?.();
		unsubscribePlaybackError = null;
		engine = null;
		playbackState.setAudioContextStatus('uninitialized');
	}

	function loadCurrentProject(nextEngine: AudioEngine): void {
		const project = projectState.project;
		if (project === null || project.song === null) return;
		nextEngine.loadProject({
			song: project.song,
			channels: project.channels,
			transport: project.transport,
			master: project.master
		});
	}

	async function ensureInitialized(): Promise<AudioEngine | null> {
		if (engine !== null) return engine;
		if (initializePromise !== null) return initializePromise;
		if (!isBrowser()) {
			playbackState.setAudioContextStatus('failed');
			statusState.push(
				'error',
				'Audio is unavailable outside a browser. Editing and saving still work.'
			);
			return null;
		}

		const generation = ownershipGeneration;
		const sequence = ++initializationSequence;
		const attempt = (async () => {
			let candidate: AudioEngine | null = null;
			try {
				candidate = createEngine();
				pendingEngine = candidate;
				await candidate.initialize();
				if (generation !== ownershipGeneration) {
					candidate.dispose();
					return null;
				}
				engine = candidate;
				pendingEngine = null;
				bindEngineEvents(candidate);
				loadCurrentProject(candidate);
				return candidate;
			} catch (error) {
				if (generation === ownershipGeneration) {
					playbackState.setAudioContextStatus('failed');
					reportAudioFailure('initialize audio', error);
				}
				candidate?.dispose();
				if (engine === candidate) releaseEngineOwnership();
				return null;
			} finally {
				if (generation === ownershipGeneration) pendingEngine = null;
				if (initializationSequence === sequence) initializePromise = null;
			}
		})();
		initializePromise = attempt;
		return attempt;
	}

	async function resumeAudio(): Promise<AudioEngine | null> {
		const nextEngine = await ensureInitialized();
		if (nextEngine === null) return null;
		try {
			await nextEngine.resumeAudioContext();
			setPlaybackAudioContextStatus(nextEngine.audioContextStatus);
			return nextEngine;
		} catch (error) {
			playbackState.setAudioContextStatus('failed');
			reportAudioFailure('resume audio', error);
			return null;
		}
	}

	function syncProject(): void {
		if (engine === null) return;
		if (projectState.project === null || projectState.project.song === null) {
			// AudioEngine has no unloadProject() API. Disposing is the only public, leak-safe way to
			// ensure a cleared or newly-created project cannot retain the prior timeline or channels.
			dispose();
			return;
		}
		try {
			loadCurrentProject(engine);
		} catch (error) {
			reportAudioFailure('synchronize the project with audio', error);
		}
	}

	function syncChannel(channelId: string): void {
		if (engine === null) return;
		const channel = projectState.project?.channels.find((candidate) => candidate.id === channelId);
		if (channel === undefined) {
			statusState.push(
				'warning',
				`Cannot synchronize audio: channel "${channelId}" no longer exists.`
			);
			return;
		}
		try {
			engine.setChannelInstrument(channelId, channel.instrument);
		} catch (error) {
			reportAudioFailure(`synchronize channel "${channelId}" with audio`, error);
		}
	}

	async function beginPreview(
		channelId: string,
		midiNote?: number,
		velocity: number = 0.9
	): Promise<PreviewHandle | null> {
		const channel = projectState.project?.channels.find((candidate) => candidate.id === channelId);
		if (channel === undefined) {
			statusState.push('warning', `Cannot preview: channel "${channelId}" no longer exists.`);
			return null;
		}
		const nextEngine = await ensureInitialized();
		if (nextEngine === null) return null;
		const defaultMidiNote = channel.role === 'percussion' ? 36 : 60;
		try {
			return nextEngine.beginPreview(channelId, midiNote ?? defaultMidiNote, velocity);
		} catch (error) {
			const detail = error instanceof PlaybackError ? error.message : error;
			reportAudioFailure(`preview channel "${channel.name}"`, detail);
			return null;
		}
	}

	function dispose(): void {
		ownershipGeneration += 1;
		initializationSequence += 1;
		const currentEngine = engine;
		const initializingEngine = pendingEngine;
		initializePromise = null;
		pendingEngine = null;
		releaseEngineOwnership();
		currentEngine?.dispose();
		if (initializingEngine !== null && initializingEngine !== currentEngine) {
			initializingEngine.dispose();
		}
	}

	function setPlaybackAudioContextStatus(status: EngineAudioContextStatus): void {
		// The Builder's persistent UI has no useful distinction for a disposed context; a future
		// gesture creates a fresh engine, so show the same retry-ready state as before initialization.
		playbackState.setAudioContextStatus(status === 'closed' ? 'uninitialized' : status);
	}

	return {
		get isInitialized(): boolean {
			return engine !== null;
		},
		get engine(): AudioEngine | null {
			return engine;
		},
		ensureInitialized,
		resumeAudio,
		syncProject,
		syncChannel,
		beginPreview,
		dispose
	};
}

export const engineClient = createEngineClient();
