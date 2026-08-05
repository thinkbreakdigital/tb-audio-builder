import { Midi } from '@tonejs/midi';
import { describe, expect, it } from 'vitest';
import { compileMidiFile } from '../src/index';
import {
	SILENTLY_IGNORED_EVENT_TYPES,
	classifyControlChange,
	classifyMetaEvent,
	isSilentlyIgnoredEventType
} from '../src/supported-events';
import { buildMidiFixture } from './fixtures/build-fixture';

describe('supported-events reporting', () => {
	it('aggregates 50 occurrences of CC74 into exactly one warning that states the count', () => {
		const fileBytes = buildMidiFixture({
			tracks: [
				{
					name: 'Filter',
					notes: [{ tick: 0, durationTicks: 10, midiNote: 60, velocity: 1 }],
					controlChanges: Array.from({ length: 50 }, (_, index) => ({
						controller: 74,
						tick: index * 10,
						value: 0.5
					}))
				}
			]
		});

		const result = compileMidiFile({ fileBytes, filename: 'cc74.mid' });
		const matching = result.warnings.filter((w) => w.eventType === 'controlChange:74');

		expect(matching).toHaveLength(1);
		expect(matching[0]?.message).toContain('50');
		expect(matching[0]?.tick).toBe(0);
		expect(matching[0]?.suggestedAction).toBe(
			'This controller is not read by the Builder runtime.'
		);
	});

	it('warns about programChange with the documented suggested action', () => {
		// Requested explicitly via the programChanges option (rather than relying on the tick-0
		// programChange @tonejs/midi's own encoder emits for every track's instrument number) so
		// this test asserts on an event it actually asked for.
		const fileBytes = buildMidiFixture({
			tracks: [
				{
					name: 'Lead',
					notes: [{ tick: 0, durationTicks: 10, midiNote: 60, velocity: 1 }],
					programChanges: [{ tick: 100, programNumber: 5 }]
				}
			]
		});

		const result = compileMidiFile({ fileBytes, filename: 'program-change.mid' });
		const warning = result.warnings.find((w) => w.eventType === 'programChange');

		expect(warning).toBeDefined();
		expect(warning?.suggestedAction).toBe('Assign an instrument to this channel in the Builder.');
	});

	it('produces no warnings for controllers 121 and 123, or for trackName, endOfTrack, or text meta events', () => {
		const baseBytes = buildMidiFixture({
			tracks: [
				{
					name: 'Clean',
					notes: [{ tick: 0, durationTicks: 10, midiNote: 60, velocity: 1 }],
					controlChanges: [
						{ controller: 121, tick: 0, value: 0 },
						{ controller: 123, tick: 0, value: 0 }
					]
				}
			]
		});
		// 'text' has no equivalent in buildMidiFixture's spec (only markers are exposed as a
		// top-level, byte-spliced meta event); header.meta is a plain public array, so pushing to
		// it and re-encoding through @tonejs/midi's own writer is the simplest correct way to add
		// one for this one case.
		const midi = new Midi(baseBytes);
		midi.header.meta.push({ text: 'Untitled', ticks: 0, type: 'text' });
		const reencoded = midi.toArray();
		const fileBytes = reencoded.buffer.slice(
			reencoded.byteOffset,
			reencoded.byteOffset + reencoded.byteLength
		) as ArrayBuffer;

		const result = compileMidiFile({ fileBytes, filename: 'clean.mid' });

		const silencedEventTypes = [
			'controlChange:121',
			'controlChange:123',
			'trackName',
			'endOfTrack',
			'text'
		];
		for (const eventType of silencedEventTypes) {
			expect(result.warnings.find((w) => w.eventType === eventType)).toBeUndefined();
		}
	});

	it('caps warnings at 200 entries and appends a warningsTruncated entry past 300 distinct event types', () => {
		// Only 128 controller numbers exist, and 4 of them (1, 7, 121, 123) are not "other
		// unsupported controller" warnings, leaving 124 distinct controlChange:N event types per
		// track. Spreading them across 3 tracks yields 3 * 124 = 372 distinct (track, eventType)
		// pairs, comfortably over the 300 required to exercise truncation.
		const unsupportedControllers = Array.from(
			{ length: 128 },
			(_, controller) => controller
		).filter((controller) => ![1, 7, 121, 123].includes(controller));
		const tracks = Array.from({ length: 3 }, (_, trackIndex) => ({
			name: `Track ${trackIndex}`,
			notes: trackIndex === 0 ? [{ tick: 0, durationTicks: 10, midiNote: 60, velocity: 1 }] : [],
			controlChanges: unsupportedControllers.map((controller, index) => ({
				controller,
				tick: index,
				value: 0.5
			}))
		}));
		const fileBytes = buildMidiFixture({ tracks });

		const result = compileMidiFile({ fileBytes, filename: 'flood.mid' });

		// §4.5 caps the real warning list at 200 entries, then §5 case 4 says truncation appends a
		// warningsTruncated entry on top of that cap, so the total is 201: 200 real warnings plus
		// the marker.
		expect(result.warnings).toHaveLength(201);
		expect(result.warnings.slice(0, 200).every((w) => w.eventType !== 'warningsTruncated')).toBe(
			true
		);
		expect(result.warnings[200]?.eventType).toBe('warningsTruncated');
	});

	it('classifies the documented silent list as unsupported-but-warning-free, and marks nothing else that way', () => {
		// "supported: true" means the Builder reads the event and turns it into song data (tempo,
		// notes, CC1/CC7, markers, ...). The silent list is a second, independent axis: those events
		// are NOT read into song data (supported: false) but are also not warned about
		// (isSilentlyIgnoredEventType: true). SILENTLY_IGNORED_EVENT_TYPES and
		// isSilentlyIgnoredEventType are both real exports of supported-events.ts, so this asserts
		// directly against them rather than against a guessed name.
		const silentMetaTypes = [
			'trackName',
			'endOfTrack',
			'text',
			'copyright',
			'instrumentName',
			'lyrics',
			'sequencerSpecific'
		];
		for (const metaType of silentMetaTypes) {
			expect(classifyMetaEvent(metaType).supported).toBe(false);
			expect(isSilentlyIgnoredEventType(metaType)).toBe(true);
		}

		const silentControllers = [121, 123];
		for (const controller of silentControllers) {
			expect(classifyControlChange(controller).supported).toBe(false);
			expect(isSilentlyIgnoredEventType(`controlChange:${controller}`)).toBe(true);
		}

		expect([...SILENTLY_IGNORED_EVENT_TYPES].sort()).toEqual(
			[...silentMetaTypes, 'controlChange:121', 'controlChange:123'].sort()
		);

		// Boundary check: documented-unsupported events that are NOT part of the silent list must
		// still produce a warning, i.e. must not be classified as silently ignored.
		expect(classifyControlChange(74).supported).toBe(false);
		expect(isSilentlyIgnoredEventType('controlChange:74')).toBe(false);
		expect(classifyControlChange(10).supported).toBe(false);
		expect(isSilentlyIgnoredEventType('controlChange:10')).toBe(false);
	});
});
