export const SUPPORTED_CONTROLLERS = { 1: 'modulation', 7: 'trackVolume' } as const;

export interface EventClassification {
	supported: boolean;
	label: string;
	suggestedAction: string | null;
}

export const SILENTLY_IGNORED_EVENT_TYPES = [
	'trackName',
	'endOfTrack',
	'text',
	'copyright',
	'instrumentName',
	'lyrics',
	'sequencerSpecific',
	'controlChange:121',
	'controlChange:123'
] as const;

const SUPPORTED_EVENT: EventClassification = {
	supported: true,
	label: 'supported event',
	suggestedAction: null
};

const SILENTLY_IGNORED_EVENT: EventClassification = {
	supported: false,
	label: 'silently ignored event',
	suggestedAction: null
};

const CONTROL_CHANGE_ACTION = 'This controller is not read by the Builder runtime.';

export function classifyControlChange(controllerNumber: number): EventClassification {
	if (controllerNumber === 1) {
		return { ...SUPPORTED_EVENT, label: 'modulation' };
	}

	if (controllerNumber === 7) {
		return { ...SUPPORTED_EVENT, label: 'track volume' };
	}

	if (controllerNumber === 121 || controllerNumber === 123) {
		return { ...SILENTLY_IGNORED_EVENT, label: `control change ${controllerNumber}` };
	}

	if (controllerNumber === 10) {
		return {
			supported: false,
			label: 'pan automation',
			suggestedAction: 'Set channel pan in the Builder mixer.'
		};
	}

	if (controllerNumber === 11) {
		return {
			supported: false,
			label: 'expression automation',
			suggestedAction: 'Use CC7 track volume, or set channel volume in the mixer.'
		};
	}

	if (controllerNumber === 64) {
		return {
			supported: false,
			label: 'sustain pedal events',
			suggestedAction: 'Lengthen the note release in the instrument envelope.'
		};
	}

	if (controllerNumber === 74) {
		return {
			supported: false,
			label: 'filter-cutoff automation',
			suggestedAction: CONTROL_CHANGE_ACTION
		};
	}

	return {
		supported: false,
		label: `controller ${controllerNumber}`,
		suggestedAction: CONTROL_CHANGE_ACTION
	};
}

export function classifyMetaEvent(metaType: string): EventClassification {
	if (
		metaType === 'tempo' ||
		metaType === 'timeSignature' ||
		metaType === 'marker' ||
		metaType === 'cuePoint'
	) {
		return { ...SUPPORTED_EVENT, label: metaType };
	}

	if (isSilentlyIgnoredEventType(metaType)) {
		return { ...SILENTLY_IGNORED_EVENT, label: metaType };
	}

	if (metaType === 'keySignature') {
		return { supported: false, label: 'key signatures', suggestedAction: null };
	}

	return { supported: false, label: metaType, suggestedAction: null };
}

export function isSilentlyIgnoredEventType(eventType: string): boolean {
	const normalizedEventType = eventType.startsWith('meta:')
		? eventType.slice('meta:'.length)
		: eventType;
	return (SILENTLY_IGNORED_EVENT_TYPES as readonly string[]).includes(normalizedEventType);
}

export function classifyScannedEvent(eventType: string): EventClassification {
	if (eventType.startsWith('controlChange:')) {
		const controllerNumber = Number(eventType.slice('controlChange:'.length));
		return Number.isInteger(controllerNumber)
			? classifyControlChange(controllerNumber)
			: { supported: false, label: eventType, suggestedAction: null };
	}

	if (eventType.startsWith('meta:')) {
		return classifyMetaEvent(eventType.slice('meta:'.length));
	}

	if (eventType === 'noteOn' || eventType === 'noteOff' || eventType === 'pitchBend') {
		return { ...SUPPORTED_EVENT, label: eventType };
	}

	if (eventType === 'programChange') {
		return {
			supported: false,
			label: 'program-change messages',
			suggestedAction: 'Assign an instrument to this channel in the Builder.'
		};
	}

	if (eventType === 'channelAftertouch' || eventType === 'polyAftertouch') {
		return {
			supported: false,
			label: 'aftertouch',
			suggestedAction: 'Aftertouch is not supported; use note velocity.'
		};
	}

	if (eventType === 'sysex') {
		return { supported: false, label: 'System Exclusive messages', suggestedAction: null };
	}

	return { supported: false, label: eventType, suggestedAction: null };
}

export function ignoredEventMessage(classification: EventClassification): string {
	return `The Builder does not read ${classification.label}.`;
}
