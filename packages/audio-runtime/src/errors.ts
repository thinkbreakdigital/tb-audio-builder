/**
 * Runtime error categories (`00-conventions.md` §7). Audio failures are classified so the Builder
 * can keep loading, saving, and exporting a project when playback breaks.
 */

/** Creating, resuming, or otherwise bringing up the `AudioContext` failed. */
export class AudioInitializationError extends Error {
	override readonly name = 'AudioInitializationError';

	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
	}
}

/** The transport, scheduler, or mixer was driven into an invalid state. */
export class PlaybackError extends Error {
	override readonly name = 'PlaybackError';

	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
	}
}
