import { describe, expect, it, vi } from 'vitest';
import { createReducedMotionController, createVisibilityController } from './visibility.js';
describe('visibility controllers', () => {
	it('installs only when constructed and removes listeners', () => {
		const listeners = new Set<() => void>();
		const source = {
			hidden: false,
			addEventListener: vi.fn((_, fn) => listeners.add(fn)),
			removeEventListener: vi.fn((_, fn) => listeners.delete(fn))
		};
		const changed = vi.fn();
		const visibility = createVisibilityController(source, changed);
		expect(source.addEventListener).toHaveBeenCalledTimes(1);
		source.hidden = true;
		for (const listener of listeners) listener();
		expect(changed).toHaveBeenCalledWith(false);
		visibility.dispose();
		visibility.dispose();
		expect(source.removeEventListener).toHaveBeenCalledTimes(1);
		const motionListeners = new Set<() => void>();
		const query = {
			matches: false,
			addEventListener: vi.fn((_, fn) => motionListeners.add(fn)),
			removeEventListener: vi.fn((_, fn) => motionListeners.delete(fn))
		};
		const motionChanged = vi.fn();
		const motion = createReducedMotionController(query, motionChanged);
		query.matches = true;
		for (const listener of motionListeners) listener();
		expect(motionChanged).toHaveBeenCalledWith(true);
		expect(motion.reduced()).toBe(true);
		motion.dispose();
		motion.dispose();
		expect(query.removeEventListener).toHaveBeenCalledTimes(1);
	});
});
