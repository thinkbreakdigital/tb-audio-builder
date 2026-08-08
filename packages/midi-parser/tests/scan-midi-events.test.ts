import { describe, expect, it } from 'vitest';
import { scanMidiEvents } from '../src/scan-midi-events';

function makeMidiFile(
	trackBodies: readonly number[][],
	declaredTrackCount = trackBodies.length
): ArrayBuffer {
	const header = [
		0x4d,
		0x54,
		0x68,
		0x64,
		0,
		0,
		0,
		6,
		0,
		1,
		(declaredTrackCount >>> 8) & 0xff,
		declaredTrackCount & 0xff,
		0x01,
		0xe0
	];
	const chunks = trackBodies.flatMap((body) => [
		0x4d,
		0x54,
		0x72,
		0x6b,
		(body.length >>> 24) & 0xff,
		(body.length >>> 16) & 0xff,
		(body.length >>> 8) & 0xff,
		body.length & 0xff,
		...body
	]);
	return new Uint8Array([...header, ...chunks]).buffer;
}

const COMPLETE_TRACK = [0, 0x90, 60, 100, 10, 0x80, 60, 0, 0, 0xff, 0x2f, 0];

describe('scanMidiEvents', () => {
	it('reports a complete well-formed scan', () => {
		const scan = scanMidiEvents(makeMidiFile([COMPLETE_TRACK]));

		expect(scan).toMatchObject({ complete: true, format: 1 });
		expect(scan?.chunks).toHaveLength(1);
		expect(scan?.chunks[0]).toMatchObject({ complete: true, groupCount: 1 });
		expect(scan?.chunks[0]?.events.map((event) => event.eventType)).toEqual([
			'noteOn',
			'noteOff',
			'meta:endOfTrack'
		]);
	});

	it('keeps events parsed before malformed status data while marking that chunk incomplete', () => {
		const scan = scanMidiEvents(makeMidiFile([[0, 0x90, 60, 100, 0, 0x90, 61], COMPLETE_TRACK]));

		expect(scan).toMatchObject({ complete: false });
		expect(scan?.chunks[0]).toMatchObject({ complete: false });
		expect(scan?.chunks[0]?.events).toEqual([
			expect.objectContaining({ eventType: 'noteOn', count: 1, firstTick: 0 })
		]);
		expect(scan?.chunks[1]).toMatchObject({ complete: true });
		expect(scan?.chunks[1]?.events.map((event) => event.eventType)).toContain('noteOn');
	});

	it('marks truncated chunk boundaries, trailing bytes, malformed VLQs, and header count mismatches incomplete', () => {
		const truncated = new Uint8Array(makeMidiFile([COMPLETE_TRACK, COMPLETE_TRACK]));
		truncated[41] = COMPLETE_TRACK.length + 1;
		const trailing = new Uint8Array([...new Uint8Array(makeMidiFile([COMPLETE_TRACK])), 0]);
		const malformedVlq = makeMidiFile([[0x81, 0x81, 0x81, 0x81, 0x81]]);
		const mismatchedCount = makeMidiFile([COMPLETE_TRACK], 2);

		expect(scanMidiEvents(truncated.buffer)).toMatchObject({ complete: false, chunks: [{}] });
		expect(scanMidiEvents(trailing.buffer)).toMatchObject({ complete: false });
		expect(scanMidiEvents(malformedVlq)).toMatchObject({ complete: false });
		expect(scanMidiEvents(mismatchedCount)).toMatchObject({ complete: false });
	});
});
