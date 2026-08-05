import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	{
		ignores: [
			'**/node_modules/**',
			'**/dist/**',
			'**/.svelte-kit/**',
			'**/build/**',
			'**/static/**',
			'**/drizzle/meta/**'
		]
	},
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
			parserOptions: { tsconfigRootDir: import.meta.dirname }
		},
		rules: {
			'no-undef': 'off'
		}
	},
	{
		files: [
			'apps/**/*.svelte',
			'apps/**/*.svelte.ts',
			'apps/**/*.svelte.js',
			'packages/**/*.svelte',
			'packages/**/*.svelte.ts',
			'packages/**/*.svelte.js'
		],
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		rules: {}
	}
);
