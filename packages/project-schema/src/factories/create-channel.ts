import type {
	AudioChannelDefinition,
	ChannelRole,
	CompiledTrack,
	InstrumentDefinition
} from '@thinkbreak/audio-runtime';
import { AudioChannelDefinitionSchema } from '../schemas/index.js';

export interface CreateChannelForTrackInput {
	track: Pick<CompiledTrack, 'id' | 'sourceTrackName'>;
	role: ChannelRole;
	instrument: InstrumentDefinition | null;
	idGenerator?: () => string;
}

export function createChannelForTrack(input: CreateChannelForTrackInput): AudioChannelDefinition {
	const idGenerator = input.idGenerator ?? (() => crypto.randomUUID());
	const channel: AudioChannelDefinition = {
		id: idGenerator(),
		name: input.track.sourceTrackName,
		role: input.role,
		sourceTrackId: input.track.id,
		enabled: true,
		instrument: input.instrument,
		mix: {
			gain: 0.8,
			pan: 0,
			muted: false,
			soloed: false
		}
	};

	return AudioChannelDefinitionSchema.parse(channel);
}
