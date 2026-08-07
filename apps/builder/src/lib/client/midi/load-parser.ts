/**
 * MIDI parsing is browser-only — it runs on `File`, `crypto.subtle` and drag-and-drop, none of
 * which exist during SSR. Loading `@thinkbreak/midi-parser` lazily keeps it, and its CommonJS
 * `@tonejs/midi` dependency, out of the server module graph entirely; a static import makes
 * SvelteKit's dev SSR fail to evaluate the page at all.
 */
export function loadMidiParser(): Promise<typeof import('@thinkbreak/midi-parser')> {
	return import('@thinkbreak/midi-parser');
}
