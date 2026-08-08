import assert from 'node:assert/strict';

const packages = [
	{
		name: '@thinkbreak/audio-runtime',
		entry: '../packages/audio-runtime/dist/index.js',
		exports: ['createAudioEngine', 'PITCHED_PRESETS', 'PERCUSSION_PRESETS']
	},
	{
		name: '@thinkbreak/project-schema',
		entry: '../packages/project-schema/dist/index.js',
		exports: ['BuilderProjectSchema', 'createEmptyProject', 'migrateProjectDocument']
	},
	{
		name: '@thinkbreak/midi-parser',
		entry: '../packages/midi-parser/dist/index.js',
		exports: ['compileMidiFile', 'MidiImportError', 'suggestRoleForTrackName']
	}
];

for (const packageCheck of packages) {
	const module = await import(new URL(packageCheck.entry, import.meta.url));
	for (const exportName of packageCheck.exports) {
		assert.ok(
			exportName in module,
			`${packageCheck.name} built entry is missing the expected ${exportName} export.`
		);
	}
}

console.log(`Verified native Node ESM imports for ${packages.length} built packages.`);
