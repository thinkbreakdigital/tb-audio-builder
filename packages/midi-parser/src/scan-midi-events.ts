export interface ScannedEvent {
	eventType: string;
	firstTick: number;
	count: number;
	groupIndex: number;
}

export interface ScannedMidiChunk {
	events: readonly ScannedEvent[];
	groupCount: number;
	complete: boolean;
}

export interface ScannedMidiFile {
	chunks: readonly ScannedMidiChunk[];
	format: number;
	complete: boolean;
}

interface VlqResult {
	value: number;
	nextByteIndex: number;
}

const META_EVENT_TYPES: Readonly<Record<number, string>> = {
	0x01: 'text',
	0x02: 'copyright',
	0x03: 'trackName',
	0x04: 'instrumentName',
	0x05: 'lyrics',
	0x06: 'marker',
	0x07: 'cuePoint',
	0x2f: 'endOfTrack',
	0x51: 'tempo',
	0x58: 'timeSignature',
	0x59: 'keySignature',
	0x7f: 'sequencerSpecific'
};

function readUint32(bytes: Uint8Array, byteIndex: number): number | undefined {
	const firstByte = bytes[byteIndex];
	const secondByte = bytes[byteIndex + 1];
	const thirdByte = bytes[byteIndex + 2];
	const fourthByte = bytes[byteIndex + 3];
	if (
		firstByte === undefined ||
		secondByte === undefined ||
		thirdByte === undefined ||
		fourthByte === undefined
	) {
		return undefined;
	}

	return firstByte * 0x1000000 + secondByte * 0x10000 + thirdByte * 0x100 + fourthByte;
}

function readUint16(bytes: Uint8Array, byteIndex: number): number | undefined {
	const firstByte = bytes[byteIndex];
	const secondByte = bytes[byteIndex + 1];
	if (firstByte === undefined || secondByte === undefined) return undefined;

	return firstByte * 0x100 + secondByte;
}

function readVlq(
	bytes: Uint8Array,
	byteIndex: number,
	endByteIndex: number
): VlqResult | undefined {
	let value = 0;
	let currentByteIndex = byteIndex;

	for (let byteCount = 0; byteCount < 4; byteCount += 1) {
		const byte = bytes[currentByteIndex];
		if (byte === undefined || currentByteIndex >= endByteIndex) return undefined;

		value = value * 0x80 + (byte & 0x7f);
		currentByteIndex += 1;
		if ((byte & 0x80) === 0) return { value, nextByteIndex: currentByteIndex };
	}

	return undefined;
}

function metaEventTypeName(metaType: number): string {
	return META_EVENT_TYPES[metaType] ?? `unknown:${metaType}`;
}

function addEvent(
	events: Map<string, ScannedEvent>,
	eventType: string,
	tick: number,
	groupIndex: number
): void {
	const eventKey = `${eventType}\u0000${groupIndex}`;
	const event = events.get(eventKey);
	if (event === undefined) {
		events.set(eventKey, { eventType, firstTick: tick, count: 1, groupIndex });
		return;
	}

	event.count += 1;
	if (tick < event.firstTick) event.firstTick = tick;
}

function scanTrack(
	bytes: Uint8Array,
	startByteIndex: number,
	endByteIndex: number
): ScannedMidiChunk {
	const events = new Map<string, ScannedEvent>();
	const trackGroups = new Map<string, number>();
	const currentProgram = Array<number>(16).fill(0);
	let byteIndex = startByteIndex;
	let tick = 0;
	let runningStatus: number | undefined;
	let complete = true;
	let sawEndOfTrack = false;

	while (byteIndex < endByteIndex) {
		const delta = readVlq(bytes, byteIndex, endByteIndex);
		if (delta === undefined) {
			complete = false;
			break;
		}
		byteIndex = delta.nextByteIndex;
		tick += delta.value;

		const nextByte = bytes[byteIndex];
		if (nextByte === undefined) {
			complete = false;
			break;
		}

		let status = nextByte;
		let dataByteIndex: number;
		if (status < 0x80) {
			if (runningStatus === undefined) {
				complete = false;
				break;
			}
			status = runningStatus;
			dataByteIndex = byteIndex;
		} else {
			byteIndex += 1;
			dataByteIndex = byteIndex;
		}

		if (status >= 0x80 && status <= 0xef) {
			runningStatus = status;
			const messageType = status & 0xf0;
			const midiChannel = status & 0x0f;
			const dataByteCount = messageType === 0xc0 || messageType === 0xd0 ? 1 : 2;
			const firstDataByte = bytes[dataByteIndex];
			const finalDataByte = bytes[dataByteIndex + dataByteCount - 1];
			if (
				firstDataByte === undefined ||
				finalDataByte === undefined ||
				dataByteIndex + dataByteCount > endByteIndex ||
				firstDataByte >= 0x80 ||
				finalDataByte >= 0x80
			) {
				complete = false;
				break;
			}

			if (messageType === 0xc0) currentProgram[midiChannel] = firstDataByte;
			const groupKey = `${currentProgram[midiChannel]} ${midiChannel}`;
			let groupIndex = trackGroups.get(groupKey);
			if (groupIndex === undefined) {
				groupIndex = trackGroups.size;
				trackGroups.set(groupKey, groupIndex);
			}

			if (messageType === 0x80) addEvent(events, 'noteOff', tick, groupIndex);
			if (messageType === 0x90) addEvent(events, 'noteOn', tick, groupIndex);
			if (messageType === 0xa0) addEvent(events, 'polyAftertouch', tick, groupIndex);
			if (messageType === 0xb0)
				addEvent(events, `controlChange:${firstDataByte}`, tick, groupIndex);
			if (messageType === 0xc0) addEvent(events, 'programChange', tick, groupIndex);
			if (messageType === 0xd0) addEvent(events, 'channelAftertouch', tick, groupIndex);
			if (messageType === 0xe0) addEvent(events, 'pitchBend', tick, groupIndex);

			byteIndex = dataByteIndex + dataByteCount;
			continue;
		}

		runningStatus = undefined;
		if (status === 0xff) {
			const metaType = bytes[byteIndex];
			if (metaType === undefined) {
				complete = false;
				break;
			}
			const payloadLength = readVlq(bytes, byteIndex + 1, endByteIndex);
			if (
				payloadLength === undefined ||
				payloadLength.nextByteIndex + payloadLength.value > endByteIndex
			) {
				complete = false;
				break;
			}

			addEvent(events, `meta:${metaEventTypeName(metaType)}`, tick, 0);
			byteIndex = payloadLength.nextByteIndex + payloadLength.value;
			if (metaType === 0x2f) {
				if (payloadLength.value !== 0 || byteIndex !== endByteIndex) complete = false;
				sawEndOfTrack = true;
				break;
			}
			continue;
		}

		if (status === 0xf0 || status === 0xf7) {
			const payloadLength = readVlq(bytes, byteIndex, endByteIndex);
			if (
				payloadLength === undefined ||
				payloadLength.nextByteIndex + payloadLength.value > endByteIndex
			) {
				complete = false;
				break;
			}

			addEvent(events, 'sysex', tick, 0);
			byteIndex = payloadLength.nextByteIndex + payloadLength.value;
			continue;
		}

		complete = false;
		break;
	}

	return {
		events: [...events.values()],
		groupCount: Math.max(1, trackGroups.size),
		complete: complete && sawEndOfTrack && byteIndex === endByteIndex
	};
}

function isChunkType(bytes: Uint8Array, byteIndex: number, type: string): boolean {
	return (
		bytes[byteIndex] === type.charCodeAt(0) &&
		bytes[byteIndex + 1] === type.charCodeAt(1) &&
		bytes[byteIndex + 2] === type.charCodeAt(2) &&
		bytes[byteIndex + 3] === type.charCodeAt(3)
	);
}

export function scanMidiEvents(fileBytes: ArrayBuffer): ScannedMidiFile | undefined {
	const bytes = new Uint8Array(fileBytes);
	if (!isChunkType(bytes, 0, 'MThd')) return undefined;

	const headerLength = readUint32(bytes, 4);
	const format = readUint16(bytes, 8);
	const declaredTrackCount = readUint16(bytes, 10);
	if (
		headerLength === undefined ||
		headerLength < 6 ||
		format === undefined ||
		declaredTrackCount === undefined ||
		8 + headerLength > bytes.length
	) {
		return undefined;
	}

	const chunks: ScannedMidiChunk[] = [];
	let byteIndex = 8 + headerLength;
	let complete = true;
	try {
		while (byteIndex < bytes.length) {
			if (byteIndex + 8 > bytes.length || !isChunkType(bytes, byteIndex, 'MTrk')) {
				complete = false;
				break;
			}

			const chunkLength = readUint32(bytes, byteIndex + 4);
			if (chunkLength === undefined || byteIndex + 8 + chunkLength > bytes.length) {
				complete = false;
				break;
			}

			const chunkStartByteIndex = byteIndex + 8;
			const chunkEndByteIndex = chunkStartByteIndex + chunkLength;
			const chunk = scanTrack(bytes, chunkStartByteIndex, chunkEndByteIndex);
			chunks.push(chunk);
			byteIndex = chunkEndByteIndex;
			// The declared chunk length still gives us a trustworthy boundary even when an event
			// inside this track is malformed. Preserve later tracks and their diagnostics too.
			if (!chunk.complete) complete = false;
		}
	} catch {
		// After a trustworthy header, retain chunks scanned before an unexpected scanner failure.
		complete = false;
	}

	if (byteIndex !== bytes.length || chunks.length !== declaredTrackCount) complete = false;
	return { chunks, format, complete };
}
