/**
 * MIDI parsing is browser-only — it runs on `File`, `crypto.subtle` and drag-and-drop, none of
 * which exist during SSR. Loading `@thinkbreak/midi-parser` lazily keeps it, and its CommonJS
 * `@tonejs/midi` dependency, out of the server module graph entirely; a static import makes
 * SvelteKit's dev SSR fail to evaluate the page at all.
 */
type MidiParserModule = typeof import('@thinkbreak/midi-parser');
type MidiParserImporter = () => Promise<MidiParserModule>;

export function createMidiParserLoader(
	importParser: MidiParserImporter = () => import('@thinkbreak/midi-parser')
): () => Promise<MidiParserModule> {
	let parserPromise: Promise<MidiParserModule> | null = null;
	return function load(): Promise<MidiParserModule> {
		if (parserPromise !== null) return parserPromise;
		parserPromise = importParser().catch((error: unknown) => {
			// A transient chunk/network failure must not poison all later import attempts.
			parserPromise = null;
			throw error;
		});
		return parserPromise;
	};
}

export const loadMidiParser = createMidiParserLoader();
