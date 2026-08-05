import type { InstrumentDefinition } from './instrument.js';

/**
 * Channels. Mixing lives here, never inside the instrument definition, so pitched and
 * percussion channels mix identically.
 */

export type ChannelRole = 'pitched' | 'percussion' | 'ignored' | 'metadata';

export interface ChannelMixSettings {
	gain: number; // 0..1, linear amplitude
	pan: number; // -1..1
	muted: boolean;
	soloed: boolean;
}

export interface AudioChannelDefinition {
	id: string;
	name: string; // user-editable; defaults to the source track name
	role: ChannelRole;
	sourceTrackId: string | null; // CompiledTrack.id; null when MIDI was removed
	enabled: boolean;
	instrument: InstrumentDefinition | null; // null for 'ignored' and 'metadata'
	mix: ChannelMixSettings;
}
