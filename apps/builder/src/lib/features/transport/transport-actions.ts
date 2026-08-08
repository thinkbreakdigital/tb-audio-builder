import type { AudioEngine, BuilderProject } from '@thinkbreak/audio-runtime';
import { validateLoopRegion, type LoopRegion } from './loop-region.js';

type EngineClient = {
	ensureInitialized(): Promise<AudioEngine | null>;
	engine: AudioEngine | null;
};
type ProjectState = {
	project: BuilderProject | null;
	updateTransport(patch: Partial<BuilderProject['transport']>): void;
};
type Reporter = { push(level: 'error' | 'warning' | 'info', text: string): void };
type Poller = { start(): void; stop(): void; sampleNow(): void };

export function createTransportActions(input: {
	engineClient: EngineClient;
	projectState: ProjectState;
	statusState: Reporter;
	poller?: Poller;
}) {
	function songOrThrow(): NonNullable<BuilderProject['song']> {
		const song = input.projectState.project?.song;
		if (!song) throw new Error('Cannot control transport: no song is loaded.');
		return song;
	}
	function report(action: string, error: unknown): void {
		input.statusState.push(
			'error',
			`Unable to ${action}: ${error instanceof Error ? error.message : String(error)}`
		);
	}
	function assertMode(mode: 'live' | 'commit'): void {
		if (mode !== 'live' && mode !== 'commit') {
			throw new Error('Tempo update mode must be live or commit.');
		}
	}
	return {
		async play(): Promise<boolean> {
			try {
				songOrThrow();
				const engine = await input.engineClient.ensureInitialized();
				if (!engine) return false;
				engine.play();
				input.poller?.start();
				return true;
			} catch (error) {
				report('start playback', error);
				return false;
			}
		},
		pause(): boolean {
			try {
				songOrThrow();
				const engine = input.engineClient.engine;
				if (!engine) throw new Error('audio is not initialized.');
				engine.pause();
				input.poller?.stop();
				input.poller?.sampleNow();
				return true;
			} catch (error) {
				report('pause playback', error);
				return false;
			}
		},
		stop(): boolean {
			try {
				const engine = input.engineClient.engine;
				if (!engine) throw new Error('audio is not initialized.');
				engine.stop();
				input.poller?.stop();
				input.poller?.sampleNow();
				return true;
			} catch (error) {
				report('stop playback', error);
				return false;
			}
		},
		returnToStart(): boolean {
			try {
				const engine = input.engineClient.engine;
				if (!engine) throw new Error('audio is not initialized.');
				engine.seekToTicks(0);
				input.poller?.sampleNow();
				return true;
			} catch (error) {
				report('return to start', error);
				return false;
			}
		},
		seekToTicks(ticks: number): boolean {
			try {
				const song = songOrThrow();
				if (!Number.isInteger(ticks) || ticks < 0 || ticks > song.durationTicks)
					throw new Error(`tick must be from 0 to ${song.durationTicks}.`);
				const engine = input.engineClient.engine;
				if (!engine) throw new Error('audio is not initialized.');
				engine.seekToTicks(ticks);
				input.poller?.sampleNow();
				return true;
			} catch (error) {
				report('seek playback', error);
				return false;
			}
		},
		seekToSeconds(seconds: number): boolean {
			try {
				if (!Number.isFinite(seconds) || seconds < 0)
					throw new Error('seconds must be a non-negative finite number.');
				songOrThrow();
				const engine = input.engineClient.engine;
				if (!engine) throw new Error('audio is not initialized.');
				if (seconds > engine.durationSeconds)
					throw new Error(`seconds must be from 0 to ${engine.durationSeconds}.`);
				engine.seekToSeconds(seconds);
				input.poller?.sampleNow();
				return true;
			} catch (error) {
				report('seek playback', error);
				return false;
			}
		},
		setTempo(multiplier: number, mode: 'live' | 'commit'): boolean {
			try {
				assertMode(mode);
				songOrThrow();
				if (!Number.isFinite(multiplier) || multiplier < 0.25 || multiplier > 4)
					throw new Error('tempo must be from 0.25× to 4×.');
				const engine = input.engineClient.engine;
				if (mode === 'commit') {
					input.projectState.updateTransport({ tempoMultiplier: multiplier });
					try {
						engine?.setTempoMultiplier(multiplier);
					} catch (error) {
						report('set tempo in the audio engine', error);
					}
					return true;
				}
				if (!engine) return false;
				engine.setTempoMultiplier(multiplier);
				return true;
			} catch (error) {
				report('set tempo', error);
				return false;
			}
		},
		setLoop(enabled: boolean, region?: LoopRegion): boolean {
			try {
				if (typeof enabled !== 'boolean') throw new Error('loop enabled must be a boolean.');
				const song = songOrThrow();
				const current = input.projectState.project!.transport;
				const next = region ?? { startTick: current.loopStartTick, endTick: current.loopEndTick };
				if (region || enabled) validateLoopRegion(next, song.durationTicks);
				const enabledChanged = current.loopEnabled !== enabled;
				if (!region && !enabledChanged) return true;
				const engine = input.engineClient.engine;
				if (region) {
					input.projectState.updateTransport({
						loopEnabled: enabled,
						loopStartTick: next.startTick,
						loopEndTick: next.endTick
					});
					try {
						engine?.setLoopRegion(next.startTick, next.endTick);
					} catch (error) {
						report('set loop region in the audio engine', error);
					}
				} else input.projectState.updateTransport({ loopEnabled: enabled });
				if (enabledChanged) {
					try {
						engine?.setLoopEnabled(enabled);
					} catch (error) {
						report('set loop state in the audio engine', error);
					}
				}
				return true;
			} catch (error) {
				report('update loop', error);
				return false;
			}
		}
	};
}
