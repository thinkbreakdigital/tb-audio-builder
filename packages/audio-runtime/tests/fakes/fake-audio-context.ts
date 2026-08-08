/**
 * Hand-written fake for the subset of `BaseAudioContext` the audio engine touches. Records node
 * creation, `connect`/`disconnect` calls, and every `AudioParam` automation call with its value
 * and time, so tests assert scheduling without a real audio device (`00-conventions.md` §9).
 *
 * This is a shared contract: the scheduler, transport, voice-manager, and mixer tests all build on
 * this exact shape, so fields are additive-only — never renamed or removed.
 */

export interface FakeAutomationCall {
	method:
		| 'setValueAtTime'
		| 'setTargetAtTime'
		| 'linearRampToValueAtTime'
		| 'exponentialRampToValueAtTime'
		| 'cancelScheduledValues';
	value: number; // for cancelScheduledValues, the param's value at the call
	atSeconds: number;
	timeConstantSeconds?: number; // setTargetAtTime only
}

export interface FakeAudioParam {
	value: number;
	readonly automation: readonly FakeAutomationCall[];
	setValueAtTime(value: number, atSeconds: number): FakeAudioParam;
	setTargetAtTime(value: number, atSeconds: number, timeConstantSeconds: number): FakeAudioParam;
	linearRampToValueAtTime(value: number, atSeconds: number): FakeAudioParam;
	exponentialRampToValueAtTime(value: number, atSeconds: number): FakeAudioParam;
	cancelScheduledValues(atSeconds: number): FakeAudioParam;
}

export type FakeNodeKind =
	| 'gain'
	| 'oscillator'
	| 'biquad-filter'
	| 'stereo-panner'
	| 'compressor'
	| 'analyser'
	| 'buffer-source'
	| 'destination';

export interface FakeAudioNode {
	readonly nodeKind: FakeNodeKind;
	readonly connectedTo: readonly FakeAudioNode[]; // current outgoing connections, in connect() order
	readonly connectCallCount: number;
	readonly disconnectCallCount: number;
	readonly disposed: boolean; // true once disconnect() with no argument was called
	connect(destination: FakeAudioNode): FakeAudioNode;
	disconnect(destination?: FakeAudioNode): void;
}

export interface FakeGainNode extends FakeAudioNode {
	readonly nodeKind: 'gain';
	readonly gain: FakeAudioParam;
}

export interface FakeOscillatorNode extends FakeAudioNode {
	readonly nodeKind: 'oscillator';
	readonly frequency: FakeAudioParam;
	readonly detune: FakeAudioParam;
	type: OscillatorType;
	/** Null until scheduled; `undefined` when started with no explicit time. */
	readonly startedAtSeconds: number | null | undefined;
	readonly stoppedAtSeconds: number | null | undefined;
	start(when?: number): void;
	stop(when?: number): void;
}

export interface FakeBiquadFilterNode extends FakeAudioNode {
	readonly nodeKind: 'biquad-filter';
	readonly frequency: FakeAudioParam;
	readonly Q: FakeAudioParam;
	readonly detune: FakeAudioParam;
	type: BiquadFilterType;
}

export interface FakeStereoPannerNode extends FakeAudioNode {
	readonly nodeKind: 'stereo-panner';
	readonly pan: FakeAudioParam;
}

export interface FakeCompressorNode extends FakeAudioNode {
	readonly nodeKind: 'compressor';
	readonly threshold: FakeAudioParam;
	readonly knee: FakeAudioParam;
	readonly ratio: FakeAudioParam;
	readonly attack: FakeAudioParam;
	readonly release: FakeAudioParam;
}

export interface FakeAnalyserNode extends FakeAudioNode {
	readonly nodeKind: 'analyser';
	fftSize: number;
	smoothingTimeConstant: number;
	readonly frequencyBinCount: number;
	getFloatTimeDomainData(array: Float32Array): void;
}

export interface FakeBufferSourceNode extends FakeAudioNode {
	readonly nodeKind: 'buffer-source';
	readonly playbackRate: FakeAudioParam;
	buffer: unknown;
	onended: (() => void) | null;
	/** Null until scheduled; `undefined` when started with no explicit time. */
	readonly startedAtSeconds: number | null | undefined;
	readonly stoppedAtSeconds: number | null | undefined;
	start(when?: number): void;
	stop(when?: number): void;
}

export interface FakeDestinationNode extends FakeAudioNode {
	readonly nodeKind: 'destination';
}

export interface FakeAudioContext {
	readonly currentTime: number;
	readonly sampleRate: number;
	readonly state: 'suspended' | 'running' | 'closed';
	readonly destination: FakeAudioNode;
	readonly createdNodes: readonly FakeAudioNode[]; // every node ever created, in creation order
	/** Test-only clock control. Monotonic — throws if moved backwards. */
	advanceTimeTo(seconds: number): void;
	advanceTimeBy(deltaSeconds: number): void;
	/** Sample data returned by the next getFloatTimeDomainData on this analyser. */
	setAnalyserSamples(node: FakeAudioNode, samples: readonly number[]): void;
	/** Arrays the fake handed to getFloatTimeDomainData, in call order — for buffer-reuse assertions. */
	readonly timeDomainReadBuffers: readonly Float32Array[];
	createGain(): FakeAudioNode;
	createOscillator(): FakeAudioNode;
	createBiquadFilter(): FakeAudioNode;
	createStereoPanner(): FakeAudioNode;
	createDynamicsCompressor(): FakeAudioNode;
	createAnalyser(): FakeAudioNode;
	createBufferSource(): FakeAudioNode;
	createBuffer(channelCount: number, frameCount: number, sampleRate: number): unknown;
	resume(): Promise<void>;
	suspend(): Promise<void>;
	close(): Promise<void>;
	addEventListener(type: string, listener: () => void): void;
	removeEventListener(type: string, listener: () => void): void;
	/** Test-only: drive the statechange path. */
	setState(state: 'suspended' | 'running' | 'closed'): void;
}

class FakeAudioParamImpl implements FakeAudioParam {
	value: number;
	private readonly calls: FakeAutomationCall[] = [];

	constructor(initialValue: number) {
		this.value = initialValue;
	}

	get automation(): readonly FakeAutomationCall[] {
		return this.calls;
	}

	setValueAtTime(value: number, atSeconds: number): FakeAudioParam {
		this.calls.push({ method: 'setValueAtTime', value, atSeconds });
		this.value = value;
		return this;
	}

	setTargetAtTime(value: number, atSeconds: number, timeConstantSeconds: number): FakeAudioParam {
		this.calls.push({ method: 'setTargetAtTime', value, atSeconds, timeConstantSeconds });
		this.value = value;
		return this;
	}

	linearRampToValueAtTime(value: number, atSeconds: number): FakeAudioParam {
		this.calls.push({ method: 'linearRampToValueAtTime', value, atSeconds });
		this.value = value;
		return this;
	}

	exponentialRampToValueAtTime(value: number, atSeconds: number): FakeAudioParam {
		this.calls.push({ method: 'exponentialRampToValueAtTime', value, atSeconds });
		this.value = value;
		return this;
	}

	cancelScheduledValues(atSeconds: number): FakeAudioParam {
		this.calls.push({ method: 'cancelScheduledValues', value: this.value, atSeconds });
		return this;
	}
}

function createFakeAudioParam(initialValue: number): FakeAudioParam {
	return new FakeAudioParamImpl(initialValue);
}

abstract class FakeAudioNodeBase implements FakeAudioNode {
	abstract readonly nodeKind: FakeNodeKind;
	private readonly outgoing: FakeAudioNode[] = [];
	private connectCalls = 0;
	private disconnectCalls = 0;
	private isDisposed = false;

	get connectedTo(): readonly FakeAudioNode[] {
		return this.outgoing;
	}

	get connectCallCount(): number {
		return this.connectCalls;
	}

	get disconnectCallCount(): number {
		return this.disconnectCalls;
	}

	get disposed(): boolean {
		return this.isDisposed;
	}

	connect(destination: FakeAudioNode): FakeAudioNode {
		this.connectCalls += 1;
		this.outgoing.push(destination);
		return destination;
	}

	disconnect(destination?: FakeAudioNode): void {
		this.disconnectCalls += 1;
		if (destination === undefined) {
			this.outgoing.length = 0;
			this.isDisposed = true;
			return;
		}
		const index = this.outgoing.indexOf(destination);
		if (index !== -1) this.outgoing.splice(index, 1);
	}
}

class FakeGainNodeImpl extends FakeAudioNodeBase implements FakeGainNode {
	readonly nodeKind = 'gain';
	readonly gain = createFakeAudioParam(1);
}

class FakeOscillatorNodeImpl extends FakeAudioNodeBase implements FakeOscillatorNode {
	readonly nodeKind = 'oscillator';
	readonly frequency = createFakeAudioParam(440);
	readonly detune = createFakeAudioParam(0);
	type: OscillatorType = 'sine';
	// Recorded rather than acted on: phases 07/08 assert when a voice was scheduled to start and
	// stop, the same way envelope shape is asserted through AudioParam automation.
	startedAtSeconds: number | null | undefined = null;
	stoppedAtSeconds: number | null | undefined = null;

	start(when?: number): void {
		this.startedAtSeconds = when;
	}

	stop(when?: number): void {
		this.stoppedAtSeconds = when;
	}
}

class FakeBiquadFilterNodeImpl extends FakeAudioNodeBase implements FakeBiquadFilterNode {
	readonly nodeKind = 'biquad-filter';
	readonly frequency = createFakeAudioParam(350);
	readonly Q = createFakeAudioParam(1);
	readonly detune = createFakeAudioParam(0);
	type: BiquadFilterType = 'lowpass';
}

class FakeStereoPannerNodeImpl extends FakeAudioNodeBase implements FakeStereoPannerNode {
	readonly nodeKind = 'stereo-panner';
	readonly pan = createFakeAudioParam(0);
}

class FakeCompressorNodeImpl extends FakeAudioNodeBase implements FakeCompressorNode {
	readonly nodeKind = 'compressor';
	readonly threshold = createFakeAudioParam(-24);
	readonly knee = createFakeAudioParam(30);
	readonly ratio = createFakeAudioParam(12);
	readonly attack = createFakeAudioParam(0.003);
	readonly release = createFakeAudioParam(0.25);
}

class FakeBufferSourceNodeImpl extends FakeAudioNodeBase implements FakeBufferSourceNode {
	readonly nodeKind = 'buffer-source';
	readonly playbackRate = createFakeAudioParam(1);
	buffer: unknown = null;
	onended: (() => void) | null = null;
	startedAtSeconds: number | null | undefined = null;
	stoppedAtSeconds: number | null | undefined = null;

	start(when?: number): void {
		this.startedAtSeconds = when;
	}

	stop(when?: number): void {
		this.stoppedAtSeconds = when;
	}
}

class FakeAnalyserNodeImpl extends FakeAudioNodeBase implements FakeAnalyserNode {
	readonly nodeKind = 'analyser';
	fftSize = 2048;
	smoothingTimeConstant = 0.8;
	private pendingSamples: readonly number[] | null = null;

	constructor(private readonly recordReadBuffer: (buffer: Float32Array) => void) {
		super();
	}

	get frequencyBinCount(): number {
		return this.fftSize / 2;
	}

	setPendingSamples(samples: readonly number[]): void {
		this.pendingSamples = samples;
	}

	getFloatTimeDomainData(array: Float32Array): void {
		this.recordReadBuffer(array);
		const samples = this.pendingSamples;
		if (samples === null) return;
		for (let i = 0; i < array.length; i += 1) {
			array[i] = samples[i] ?? 0;
		}
	}
}

class FakeDestinationNodeImpl extends FakeAudioNodeBase implements FakeDestinationNode {
	readonly nodeKind = 'destination';
}

class FakeAudioContextImpl implements FakeAudioContext {
	readonly sampleRate: number;
	readonly destination: FakeAudioNode;
	private time = 0;
	private contextState: 'suspended' | 'running' | 'closed' = 'suspended';
	private readonly nodes: FakeAudioNode[] = [];
	private readonly listeners = new Map<string, Set<() => void>>();
	private readonly readBuffers: Float32Array[] = [];

	constructor(options?: { sampleRate?: number }) {
		this.sampleRate = options?.sampleRate ?? 44100;
		this.destination = this.register(new FakeDestinationNodeImpl());
	}

	get currentTime(): number {
		return this.time;
	}

	get state(): 'suspended' | 'running' | 'closed' {
		return this.contextState;
	}

	get createdNodes(): readonly FakeAudioNode[] {
		return this.nodes;
	}

	get timeDomainReadBuffers(): readonly Float32Array[] {
		return this.readBuffers;
	}

	private register<N extends FakeAudioNode>(node: N): N {
		this.nodes.push(node);
		return node;
	}

	advanceTimeTo(seconds: number): void {
		if (seconds < this.time) {
			throw new Error(
				`FakeAudioContext.advanceTimeTo: cannot move time backwards from ${this.time}s to ${seconds}s.`
			);
		}
		this.time = seconds;
	}

	advanceTimeBy(deltaSeconds: number): void {
		this.advanceTimeTo(this.time + deltaSeconds);
	}

	setAnalyserSamples(node: FakeAudioNode, samples: readonly number[]): void {
		if (!(node instanceof FakeAnalyserNodeImpl)) {
			throw new Error(
				`FakeAudioContext.setAnalyserSamples: node "${node.nodeKind}" is not an analyser node.`
			);
		}
		node.setPendingSamples(samples);
	}

	createGain(): FakeAudioNode {
		return this.register(new FakeGainNodeImpl());
	}

	createOscillator(): FakeAudioNode {
		return this.register(new FakeOscillatorNodeImpl());
	}

	createBiquadFilter(): FakeAudioNode {
		return this.register(new FakeBiquadFilterNodeImpl());
	}

	createStereoPanner(): FakeAudioNode {
		return this.register(new FakeStereoPannerNodeImpl());
	}

	createDynamicsCompressor(): FakeAudioNode {
		return this.register(new FakeCompressorNodeImpl());
	}

	createAnalyser(): FakeAudioNode {
		return this.register(new FakeAnalyserNodeImpl((buffer) => this.readBuffers.push(buffer)));
	}

	createBufferSource(): FakeAudioNode {
		return this.register(new FakeBufferSourceNodeImpl());
	}

	createBuffer(channelCount: number, frameCount: number, sampleRate: number): unknown {
		return {
			channelCount,
			frameCount,
			sampleRate,
			getChannelData: () => new Float32Array(frameCount)
		};
	}

	async resume(): Promise<void> {
		this.setState('running');
	}

	async suspend(): Promise<void> {
		this.setState('suspended');
	}

	async close(): Promise<void> {
		this.setState('closed');
	}

	addEventListener(type: string, listener: () => void): void {
		const set = this.listeners.get(type) ?? new Set();
		set.add(listener);
		this.listeners.set(type, set);
	}

	removeEventListener(type: string, listener: () => void): void {
		this.listeners.get(type)?.delete(listener);
	}

	setState(state: 'suspended' | 'running' | 'closed'): void {
		if (this.contextState === state) return;
		this.contextState = state;
		for (const listener of this.listeners.get('statechange') ?? new Set<() => void>()) {
			listener();
		}
	}
}

export function createFakeAudioContext(options?: { sampleRate?: number }): FakeAudioContext {
	return new FakeAudioContextImpl(options);
}

function assertNodeKind<N extends FakeAudioNode>(
	node: FakeAudioNode,
	kind: FakeNodeKind
): asserts node is N {
	if (node.nodeKind !== kind) {
		throw new Error(`Expected a "${kind}" node but got "${node.nodeKind}".`);
	}
}

export function asFakeGainNode(node: FakeAudioNode): FakeGainNode {
	assertNodeKind<FakeGainNode>(node, 'gain');
	return node;
}

export function asFakeOscillatorNode(node: FakeAudioNode): FakeOscillatorNode {
	assertNodeKind<FakeOscillatorNode>(node, 'oscillator');
	return node;
}

export function asFakeBiquadFilterNode(node: FakeAudioNode): FakeBiquadFilterNode {
	assertNodeKind<FakeBiquadFilterNode>(node, 'biquad-filter');
	return node;
}

export function asFakeStereoPannerNode(node: FakeAudioNode): FakeStereoPannerNode {
	assertNodeKind<FakeStereoPannerNode>(node, 'stereo-panner');
	return node;
}

export function asFakeCompressorNode(node: FakeAudioNode): FakeCompressorNode {
	assertNodeKind<FakeCompressorNode>(node, 'compressor');
	return node;
}

export function asFakeAnalyserNode(node: FakeAudioNode): FakeAnalyserNode {
	assertNodeKind<FakeAnalyserNode>(node, 'analyser');
	return node;
}

export function asFakeBufferSourceNode(node: FakeAudioNode): FakeBufferSourceNode {
	assertNodeKind<FakeBufferSourceNode>(node, 'buffer-source');
	return node;
}

export function asFakeDestinationNode(node: FakeAudioNode): FakeDestinationNode {
	assertNodeKind<FakeDestinationNode>(node, 'destination');
	return node;
}

/**
 * The fake implements only the subset of BaseAudioContext this engine uses; production code is
 * typed against the real interface, so the boundary needs one explicit cast, here.
 */
export function asBaseAudioContext(fake: FakeAudioContext): BaseAudioContext {
	// `unknown` cast: FakeAudioContext is structurally partial (test-only fields, no inheritance
	// from the DOM lib type), so it can never satisfy BaseAudioContext directly. This is the single
	// boundary where that gap is bridged, per 00-conventions.md §4 rule 1.
	return fake as unknown as BaseAudioContext;
}

/** See asBaseAudioContext() — the same boundary cast for individual nodes. */
export function asAudioNode(fake: FakeAudioNode): AudioNode {
	// `unknown` cast: see asBaseAudioContext().
	return fake as unknown as AudioNode;
}
