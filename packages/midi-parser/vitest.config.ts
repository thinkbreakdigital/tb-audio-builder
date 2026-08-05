export default {
	root: new URL('.', import.meta.url).pathname,
	test: {
		expect: { requireAssertions: true },
		include: ['tests/**/*.test.ts']
	}
};
