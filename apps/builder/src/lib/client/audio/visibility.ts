export interface VisibilitySource {
	hidden: boolean;
	addEventListener(type: 'visibilitychange', listener: () => void): void;
	removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

export interface MotionQuery {
	matches: boolean;
	addEventListener(type: 'change', listener: () => void): void;
	removeEventListener(type: 'change', listener: () => void): void;
}

/** Explicitly constructed by the host; importing this module installs no DOM listeners. */
export function createVisibilityController(
	source: VisibilitySource,
	onChange: (visible: boolean) => void
) {
	let disposed = false;
	const listener = () => onChange(!source.hidden);
	source.addEventListener('visibilitychange', listener);
	return {
		isVisible: () => !source.hidden,
		dispose: () => {
			if (disposed) return;
			disposed = true;
			source.removeEventListener('visibilitychange', listener);
		}
	};
}

export function createReducedMotionController(
	query: MotionQuery,
	onChange: (reduced: boolean) => void
) {
	let disposed = false;
	const listener = () => onChange(query.matches);
	query.addEventListener('change', listener);
	return {
		reduced: () => query.matches,
		dispose: () => {
			if (disposed) return;
			disposed = true;
			query.removeEventListener('change', listener);
		}
	};
}
