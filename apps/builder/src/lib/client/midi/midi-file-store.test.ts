import { beforeEach, describe, expect, it } from 'vitest';
import { midiFileStore } from './midi-file-store.js';

beforeEach(() => {
	midiFileStore.clear();
});

describe('midiFileStore', () => {
	it('owns a copy of bytes written to it and returns independent copies', () => {
		const source = new Uint8Array([1, 2, 3]).buffer;
		midiFileStore.put('a'.repeat(64), 'song.mid', source);
		new Uint8Array(source)[0] = 9;

		const firstRead = midiFileStore.get('a'.repeat(64));
		expect(firstRead && Array.from(new Uint8Array(firstRead.fileBytes))).toEqual([1, 2, 3]);
		if (firstRead !== null) new Uint8Array(firstRead.fileBytes)[1] = 9;

		const secondRead = midiFileStore.get('a'.repeat(64));
		expect(secondRead && Array.from(new Uint8Array(secondRead.fileBytes))).toEqual([1, 2, 3]);
	});

	it('reports ownership and removes a stored blob explicitly', () => {
		const sha256 = 'b'.repeat(64);
		midiFileStore.put(sha256, 'song.mid', new ArrayBuffer(1));
		expect(midiFileStore.has(sha256)).toBe(true);

		midiFileStore.delete(sha256);
		expect(midiFileStore.has(sha256)).toBe(false);
		expect(midiFileStore.get(sha256)).toBeNull();
	});
});
