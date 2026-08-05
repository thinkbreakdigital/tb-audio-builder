import { describe, expect, test } from 'vitest';
import { BuilderProjectSchema, createChannelForTrack, createEmptyProject } from '../src';

const TRACK_ID = '00000000-0000-4000-8000-000000000010';

describe('factories', () => {
	test('creates a schema-valid empty project with injected time and ID', () => {
		const project = createEmptyProject({
			name: 'Test project',
			nowMs: 123,
			idGenerator: () => '00000000-0000-4000-8000-000000000001'
		});
		expect(BuilderProjectSchema.safeParse(project).success).toBe(true);
		expect(project).toMatchObject({
			id: '00000000-0000-4000-8000-000000000001',
			createdAtMs: 123,
			updatedAtMs: 123
		});
	});

	test('default ID generation produces distinct project IDs', () => {
		expect(createEmptyProject({ name: 'One' }).id).not.toBe(createEmptyProject({ name: 'Two' }).id);
	});

	test('channel IDs are injectable and mix objects are independent', () => {
		const makeChannel = (id: string) =>
			createChannelForTrack({
				track: { id: TRACK_ID, sourceTrackName: 'Lead' },
				role: 'pitched',
				instrument: null,
				idGenerator: () => id
			});
		const first = makeChannel('00000000-0000-4000-8000-000000000002');
		const second = makeChannel('00000000-0000-4000-8000-000000000003');
		first.mix.gain = 0;
		expect(second.mix.gain).toBe(0.8);
		expect(first.id).toBe('00000000-0000-4000-8000-000000000002');
	});
});
