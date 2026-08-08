/**
 * The API the Builder and every exported project use. It owns the context controller, the mixer
 * graph, channel state, solo computation, instrument resolution, and the dispatch callback that
 * bridges the scheduler to the voice manager.
 *
 * It installs no global listeners: page visibility is the caller's job (spec §4.9 rule 7), because
 * a library that attaches to `document` is a side effect its host cannot undo.
 */

import {
	DEFAULT_AUDIO_LIMITS,
	DEFAULT_COMPRESSOR,
	DEFAULT_MASTER_GAIN,
	DEFAULT_TEMPO_MULTIPLIER,
	MAX_TEMPO_MULTIPLIER,
	MIN_TEMPO_MULTIPLIER,
	PREVIEW_RELEASE_SECONDS,
	PREVIEW_START_OFFSET_SECONDS
} from '../constants.js';
import { PlaybackError } from '../errors.js';
import { createChannelBus } from '../mixer/channel-bus.js';
import type { ChannelBus } from '../mixer/channel-bus.js';
import { createMasterBus } from '../mixer/master-bus.js';
import type { MasterBus } from '../mixer/master-bus.js';
import { clamp } from '../synth/conversions.js';
import { createPercussionVoiceFactory, resolveChokeGroup } from '../synth/percussion-voice.js';
import { createPitchedVoiceFactory } from '../synth/pitched-voice.js';
import { resolveMaxVoicesForChannel, resolveVoicePriority } from '../synth/voice-priority.js';
import { createVoiceFactoryRegistry } from '../synth/voice.js';
import type { PitchBendPoint, VoiceFactory } from '../synth/voice.js';
import type { AudioChannelDefinition, ChannelMixSettings, ChannelRole } from '../types/channel.js';
import type { InstrumentDefinition } from '../types/instrument.js';
import type { BuilderProject, CompressorSettings } from '../types/project.js';
import type { CompiledSong, PitchBendEvent } from '../types/song.js';
import { findFirstIndexAtOrAfter, type NumericKeyOf } from '../util/binary-search.js';
import { createAudioContextController } from './audio-context.js';
import { buildEventTimeline } from './event-timeline.js';
import type { EventTimeline } from './event-timeline.js';
import type { DispatchNote } from './scheduler.js';
import { createTempoMap, secondsToTick, tickToSeconds } from './tempo-map.js';
import type { TempoMap } from './tempo-map.js';
import { createTransport } from './transport.js';
import type { Transport, TransportStatus } from './transport.js';
import { createVoiceManager } from './voice-manager.js';

export interface AudioEngine {
	initialize(): Promise<void>;
	play(): void;
	pause(): void;
	stop(): void;
	seekToSeconds(seconds: number): void;
	seekToTicks(ticks: number): void;

	setLoopEnabled(enabled: boolean): void;
	setLoopRegion(startTick: number, endTick: number): void;
	setTempoMultiplier(multiplier: number): void;
	setMasterVolume(value: number): void;
	setMasterCompressor(settings: CompressorSettings): void;

	setChannelVolume(channelId: string, value: number): void;
	setChannelPan(channelId: string, value: number): void;
	setChannelMuted(channelId: string, muted: boolean): void;
	setChannelSoloed(channelId: string, soloed: boolean): void;
	setChannelEnabled(channelId: string, enabled: boolean): void;
	setChannelInstrument(channelId: string, instrument: InstrumentDefinition | null): void;

	triggerPreview(channelId: string, midiNote: number, velocity: number): void;

	loadProject(input: {
		song: CompiledSong;
		channels: readonly AudioChannelDefinition[];
		transport: BuilderProject['transport'];
		master: BuilderProject['master'];
	}): void;

	readonly status: TransportStatus;
	readonly positionSeconds: number;
	readonly positionTicks: number;
	readonly durationSeconds: number;
	readonly durationTicks: number;
	readonly activeVoiceCount: number;
	readChannelLevel(channelId: string): number;
	readMasterLevel(): number;

	dispose(): void;
}

const pitchBendTickOf: NumericKeyOf<PitchBendEvent> = (event) => event.tick;

/** The engine's own mutable copy of a channel; the caller's project objects are never mutated. */
interface EngineChannel {
	id: string;
	role: ChannelRole;
	enabled: boolean;
	instrument: InstrumentDefinition | null;
	mix: ChannelMixSettings;
}

export function createAudioEngine(options?: {
	contextFactory?: () => BaseAudioContext;
	schedulerSettings?: { lookaheadMs: number; intervalMs: number };
	/**
	 * Deliberate extension beyond spec §4.9's documented options. Phase 06 registered only
	 * silent factories (§7), and phases 07/08 needed a seam to register real ones; tests still use
	 * that seam to hold on to a silent factory's `createdVoices` view. Defaults to the real pitched
	 * and percussion factories.
	 */
	voiceFactories?: readonly VoiceFactory[];
}): AudioEngine {
	const controller = createAudioContextController({ contextFactory: options?.contextFactory });

	const registry = createVoiceFactoryRegistry();
	const factories = options?.voiceFactories ?? [
		createPitchedVoiceFactory(),
		createPercussionVoiceFactory()
	];
	for (const factory of factories) registry.register(factory);

	// Project state, valid with or without a context — everything here is applied to the graph when
	// one exists, and re-applied when the graph is rebuilt (§4.9 rule 5).
	const channels = new Map<string, EngineChannel>();
	/** Source-track pitch bends per channel, sorted by tick; empty for channels with no MIDI. */
	const channelPitchBends = new Map<string, readonly PitchBendEvent[]>();

	const voiceManager = createVoiceManager({
		registry,
		limits: {
			maxTotalVoices: DEFAULT_AUDIO_LIMITS.maxTotalVoices,
			maxVoicesPerChannel: DEFAULT_AUDIO_LIMITS.maxVoicesPerChannel
		},
		// The drone cap is a property of the sound, so it is derived per channel from the instrument
		// currently assigned to it rather than baked into the manager's limits (§4.2).
		maxVoicesPerChannelOverride: (channelId) => {
			const instrument = channels.get(channelId)?.instrument;
			if (instrument === undefined || instrument === null) return undefined;
			return resolveMaxVoicesForChannel(instrument, DEFAULT_AUDIO_LIMITS);
		}
	});

	let tempoMap: TempoMap | null = null;
	let timeline: EventTimeline | null = null;
	let masterGain = DEFAULT_MASTER_GAIN;
	let masterCompressor: CompressorSettings = DEFAULT_COMPRESSOR;
	let tempoMultiplier: number = DEFAULT_TEMPO_MULTIPLIER;
	let loopEnabled = false;
	let loopStartTick = 0;
	let loopEndTick = 0;
	let pendingSeekTick: number | null = null;

	// Live graph, null until initialize() has produced a context.
	let masterBus: MasterBus | null = null;
	const channelBuses = new Map<string, ChannelBus>();
	let transport: Transport | null = null;
	let disposed = false;

	function ensureNotDisposed(action: string): void {
		if (disposed) {
			throw new PlaybackError(`AudioEngine: cannot ${action} after dispose().`);
		}
	}

	function nowSeconds(): number {
		return controller.currentTimeSeconds;
	}

	function requireChannel(channelId: string, action: string): EngineChannel {
		const channel = channels.get(channelId);
		if (channel === undefined) {
			throw new PlaybackError(
				`AudioEngine.${action}: no channel "${channelId}" in the loaded project.`
			);
		}
		return channel;
	}

	/**
	 * Recomputed for every channel whenever any mute/solo/enabled flag changes (§4.9 rule 3), and
	 * pushed to the buses right after they are built — `createChannelBus` only guesses from
	 * `!mix.muted`, so this is the authoritative call.
	 */
	function applyChannelAudibility(): void {
		const anyChannelSoloed = [...channels.values()].some((channel) => channel.mix.soloed);
		const atSeconds = nowSeconds();
		for (const [channelId, channel] of channels) {
			const bus = channelBuses.get(channelId);
			if (bus === undefined) continue;
			const audible =
				channel.enabled && !channel.mix.muted && (!anyChannelSoloed || channel.mix.soloed);
			bus.setAudible(audible, atSeconds);
		}
	}

	function applyLoopToTransport(): void {
		if (transport === null) return;
		// A project that carries no region (0, 0) simply has no loop; the transport's own default
		// region is already disabled, so there is nothing to push.
		if (loopEndTick <= loopStartTick) return;
		transport.setLoop({ enabled: loopEnabled, startTick: loopStartTick, endTick: loopEndTick });
	}

	/**
	 * Bends that fall inside the note's half-open tick span, mapped onto audio-context time.
	 *
	 * The mapping is anchored on the note's own `startAtSeconds` rather than re-deriving the
	 * scheduler's origin: the two are equal by construction, and using the value the scheduler just
	 * handed us keeps bends aligned even when the note was dispatched inside a loop wrap, where the
	 * origin has already moved on. Both ends of the span are located by binary search, so a long
	 * bend list is never scanned per note (§4.4).
	 */
	function pitchBendPointsForNote(
		channelId: string,
		startTick: number,
		endTick: number,
		startAtSeconds: number
	): readonly PitchBendPoint[] | undefined {
		const bends = channelPitchBends.get(channelId);
		if (bends === undefined || bends.length === 0 || tempoMap === null) return undefined;

		const firstIndex = findFirstIndexAtOrAfter(bends, startTick, pitchBendTickOf);
		const endIndex = findFirstIndexAtOrAfter(bends, endTick, pitchBendTickOf);
		if (endIndex <= firstIndex) return undefined;

		const effectiveMultiplier = clamp(tempoMultiplier, MIN_TEMPO_MULTIPLIER, MAX_TEMPO_MULTIPLIER);
		const noteStartSongSeconds = tickToSeconds(tempoMap, startTick);
		const points: PitchBendPoint[] = [];
		for (let index = firstIndex; index < endIndex; index += 1) {
			const bend = bends[index] as PitchBendEvent;
			points.push({
				atSeconds:
					startAtSeconds +
					(tickToSeconds(tempoMap, bend.tick) - noteStartSongSeconds) / effectiveMultiplier,
				value: bend.value
			});
		}
		return points;
	}

	/**
	 * A choke group cuts whatever is already sounding in the same group, immediately before the new
	 * hit starts (§4.4 rule 2) — a closed hi-hat silencing a ringing open one. It runs on both the
	 * scheduled and the preview path, so an auditioned hat chokes exactly as a played one does.
	 */
	function chokeGroupBefore(instrument: InstrumentDefinition, startAtSeconds: number): void {
		const chokeGroup = resolveChokeGroup(instrument);
		if (chokeGroup === null) return;
		voiceManager.stopChokeGroup(chokeGroup, startAtSeconds);
	}

	/**
	 * Channels are resolved here, at dispatch time, never in the timeline (§4.3 rule 2, §4.9
	 * rule 2), so instrument and enablement edits take effect without a rebuild. Mute and solo
	 * deliberately do NOT skip dispatch: they are gain-only on the bus, so un-muting mid-note is
	 * instantly audible. `enabled === false` does skip, because a silent channel should not burn a
	 * voice.
	 */
	const dispatch: DispatchNote = (event, startAtSeconds, releaseAtSeconds) => {
		const context = controller.context;
		if (context === null) return;
		const channel = channels.get(event.channelId);
		if (channel === undefined || !channel.enabled || channel.instrument === null) return;
		const bus = channelBuses.get(event.channelId);
		if (bus === undefined) return;

		chokeGroupBefore(channel.instrument, startAtSeconds);
		voiceManager.start(
			{
				channelId: event.channelId,
				instrument: channel.instrument,
				midiNote: event.midiNote,
				velocity: event.velocity,
				startAtSeconds,
				releaseAtSeconds,
				destination: bus.input,
				context,
				sequence: event.sequence,
				pitchBendPoints: pitchBendPointsForNote(
					event.channelId,
					event.tick,
					event.endTick,
					startAtSeconds
				)
			},
			resolveVoicePriority(channel.instrument)
		);
	};

	function teardownGraph(): void {
		transport?.dispose();
		transport = null;
		// Stops and disposes every voice and clears the manager's state; the manager itself is
		// reusable, so project replacement leaks neither voices nor nodes.
		voiceManager.dispose();
		for (const bus of channelBuses.values()) bus.dispose();
		channelBuses.clear();
		masterBus?.dispose();
		masterBus = null;
	}

	function rebuildGraph(): void {
		teardownGraph();
		const context = controller.context;
		if (context === null || tempoMap === null || timeline === null) return;

		masterBus = createMasterBus({
			context,
			settings: { gain: masterGain, compressor: masterCompressor }
		});
		for (const [channelId, channel] of channels) {
			// Only channels that can sound get a bus. `ignored` and `metadata` never produce audio.
			if (channel.role !== 'pitched' && channel.role !== 'percussion') continue;
			channelBuses.set(
				channelId,
				createChannelBus({
					context,
					channelId,
					destination: masterBus.input,
					mix: channel.mix
				})
			);
		}
		applyChannelAudibility();

		transport = createTransport({
			context,
			tempoMap,
			timeline,
			voiceManager,
			dispatch,
			settings: options?.schedulerSettings
		});
		transport.setTempoMultiplier(tempoMultiplier);
		applyLoopToTransport();
		if (pendingSeekTick !== null) {
			transport.seekToTick(pendingSeekTick);
			pendingSeekTick = null;
		}
	}

	return {
		async initialize(): Promise<void> {
			ensureNotDisposed('initialize()');
			await controller.initialize();
			rebuildGraph();
		},

		loadProject(input): void {
			ensureNotDisposed('loadProject()');
			channels.clear();
			channelPitchBends.clear();
			const tracksById = new Map(input.song.tracks.map((track) => [track.id, track]));
			for (const definition of input.channels) {
				channels.set(definition.id, {
					id: definition.id,
					role: definition.role,
					enabled: definition.enabled,
					instrument: definition.instrument,
					mix: { ...definition.mix }
				});
				const track =
					definition.sourceTrackId === null ? undefined : tracksById.get(definition.sourceTrackId);
				if (track !== undefined && track.pitchBends.length > 0) {
					channelPitchBends.set(definition.id, track.pitchBends);
				}
			}
			loopEnabled = input.transport.loopEnabled;
			loopStartTick = input.transport.loopStartTick;
			loopEndTick = input.transport.loopEndTick;
			tempoMultiplier = input.transport.tempoMultiplier;
			masterGain = input.master.gain;
			masterCompressor = input.master.compressor;
			pendingSeekTick = null; // the position resets to 0 on every load

			// Pure, so both exist before the context does; the graph below needs a context, these do not.
			tempoMap = createTempoMap({
				tempoChanges: input.song.tempoChanges,
				ticksPerQuarterNote: input.song.ticksPerQuarterNote,
				durationTicks: input.song.durationTicks
			});
			timeline = buildEventTimeline({ song: input.song, channels: input.channels });

			rebuildGraph();
		},

		play(): void {
			ensureNotDisposed('play()');
			if (controller.context === null) {
				throw new PlaybackError(
					`AudioEngine.play() was called before initialize(); the audio context status is ` +
						`"${controller.status}". Initialize from a user-gesture handler first.`
				);
			}
			if (transport === null) {
				throw new PlaybackError('AudioEngine.play() was called before loadProject(); no song.');
			}
			transport.play();
		},

		pause(): void {
			ensureNotDisposed('pause()');
			transport?.pause();
		},

		stop(): void {
			ensureNotDisposed('stop()');
			transport?.stop();
		},

		seekToTicks(ticks: number): void {
			ensureNotDisposed('seekToTicks()');
			if (transport === null) {
				pendingSeekTick = Math.max(ticks, 0);
				return;
			}
			transport.seekToTick(ticks);
		},

		seekToSeconds(seconds: number): void {
			ensureNotDisposed('seekToSeconds()');
			if (transport === null) {
				pendingSeekTick = tempoMap === null ? null : Math.max(secondsToTick(tempoMap, seconds), 0);
				return;
			}
			transport.seekToSeconds(seconds);
		},

		setLoopEnabled(enabled: boolean): void {
			ensureNotDisposed('setLoopEnabled()');
			loopEnabled = enabled;
			applyLoopToTransport();
		},

		setLoopRegion(startTick: number, endTick: number): void {
			ensureNotDisposed('setLoopRegion()');
			if (endTick <= startTick) {
				throw new PlaybackError(
					`AudioEngine.setLoopRegion: region [${startTick}, ${endTick}) is empty; ` +
						`endTick must be greater than startTick.`
				);
			}
			loopStartTick = startTick;
			loopEndTick = endTick;
			applyLoopToTransport();
		},

		setTempoMultiplier(multiplier: number): void {
			ensureNotDisposed('setTempoMultiplier()');
			tempoMultiplier = multiplier;
			transport?.setTempoMultiplier(multiplier);
		},

		setMasterVolume(value: number): void {
			ensureNotDisposed('setMasterVolume()');
			masterGain = value;
			masterBus?.setGain(value, nowSeconds());
		},

		setMasterCompressor(settings: CompressorSettings): void {
			ensureNotDisposed('setMasterCompressor()');
			masterCompressor = settings;
			masterBus?.setCompressor(settings, nowSeconds());
		},

		setChannelVolume(channelId: string, value: number): void {
			ensureNotDisposed('setChannelVolume()');
			const channel = requireChannel(channelId, 'setChannelVolume');
			channel.mix.gain = value;
			channelBuses.get(channelId)?.setGain(value, nowSeconds());
		},

		setChannelPan(channelId: string, value: number): void {
			ensureNotDisposed('setChannelPan()');
			const channel = requireChannel(channelId, 'setChannelPan');
			channel.mix.pan = value;
			channelBuses.get(channelId)?.setPan(value, nowSeconds());
		},

		setChannelMuted(channelId: string, muted: boolean): void {
			ensureNotDisposed('setChannelMuted()');
			requireChannel(channelId, 'setChannelMuted').mix.muted = muted;
			applyChannelAudibility();
		},

		setChannelSoloed(channelId: string, soloed: boolean): void {
			ensureNotDisposed('setChannelSoloed()');
			requireChannel(channelId, 'setChannelSoloed').mix.soloed = soloed;
			applyChannelAudibility();
		},

		setChannelEnabled(channelId: string, enabled: boolean): void {
			ensureNotDisposed('setChannelEnabled()');
			requireChannel(channelId, 'setChannelEnabled').enabled = enabled;
			applyChannelAudibility();
		},

		setChannelInstrument(channelId: string, instrument: InstrumentDefinition | null): void {
			ensureNotDisposed('setChannelInstrument()');
			// Future notes only: sounding voices keep the instrument they were started with, and the
			// timeline is never rebuilt here (§4.9 rule 2).
			requireChannel(channelId, 'setChannelInstrument').instrument = instrument;
		},

		triggerPreview(channelId: string, midiNote: number, velocity: number): void {
			ensureNotDisposed('triggerPreview()');
			const channel = requireChannel(channelId, 'triggerPreview');
			const context = controller.context;
			const bus = channelBuses.get(channelId);
			// Before initialize() there is nothing to audition; previewing is a no-op rather than an
			// error, unlike play() (§4.9 rule 5).
			if (context === null || bus === undefined || channel.instrument === null) return;

			const startAtSeconds = context.currentTime + PREVIEW_START_OFFSET_SECONDS;
			chokeGroupBefore(channel.instrument, startAtSeconds);
			voiceManager.start(
				{
					channelId,
					instrument: channel.instrument,
					midiNote,
					velocity,
					startAtSeconds,
					releaseAtSeconds: startAtSeconds + PREVIEW_RELEASE_SECONDS,
					destination: bus.input,
					context
				},
				resolveVoicePriority(channel.instrument)
			);
		},

		get status(): TransportStatus {
			ensureNotDisposed('read status');
			return transport?.status ?? 'stopped';
		},

		get positionTicks(): number {
			ensureNotDisposed('read positionTicks');
			return transport?.positionTicks ?? pendingSeekTick ?? 0;
		},

		get positionSeconds(): number {
			ensureNotDisposed('read positionSeconds');
			if (transport !== null) return transport.positionSeconds;
			if (tempoMap === null) return 0;
			return tickToSeconds(tempoMap, pendingSeekTick ?? 0);
		},

		get durationTicks(): number {
			ensureNotDisposed('read durationTicks');
			return tempoMap?.durationTicks ?? 0;
		},

		get durationSeconds(): number {
			ensureNotDisposed('read durationSeconds');
			return tempoMap?.durationSeconds ?? 0;
		},

		get activeVoiceCount(): number {
			ensureNotDisposed('read activeVoiceCount');
			return voiceManager.activeVoiceCount;
		},

		readChannelLevel(channelId: string): number {
			ensureNotDisposed('readChannelLevel()');
			return channelBuses.get(channelId)?.readPeakLevel() ?? 0;
		},

		readMasterLevel(): number {
			ensureNotDisposed('readMasterLevel()');
			return masterBus?.readPeakLevel() ?? 0;
		},

		dispose(): void {
			// Calling dispose() twice is safe; every other method throws afterwards.
			if (disposed) return;
			disposed = true;
			teardownGraph();
			// Teardown is synchronous and best-effort: a failing close must not throw from here.
			void controller.close().catch(() => undefined);
		}
	};
}
