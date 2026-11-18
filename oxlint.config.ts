import tsm from '@navikt/tsm-oxlint'
import { defineConfig } from 'oxlint'

import { restrict } from './oxlint.boundaries.ts'

const testFiles = ['src/**/*.test.{ts,tsx}', 'src/**/__tests__/**/*.ts']

export default defineConfig({
    extends: [tsm],
    plugins: ['vitest'],
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: ['docs/.vitepress/**'],
    overrides: [
        /**
         * Production code: layer boundaries + never depend on test utilities
         */
        {
            files: ['src/test/**/*.ts'],
            rules: { 'no-restricted-imports': restrict('/test', ['testUtils']) },
        },
        {
            files: ['src/smart/**/*.ts'],
            rules: { 'no-restricted-imports': restrict('/smart', ['test', 'testUtils']) },
        },
        {
            files: ['src/fhir/**/*.ts'],
            rules: { 'no-restricted-imports': restrict('/fhir', ['smart', 'test', 'testUtils']) },
        },
        {
            files: ['src/zod/**/*.ts'],
            rules: { 'no-restricted-imports': restrict('/zod', ['smart', 'fhir', 'test', 'testUtils']) },
        },
        {
            files: ['src/internal/**/*.ts'],
            rules: { 'no-restricted-imports': restrict('/internal', ['smart', 'fhir', 'zod', 'test', 'testUtils']) },
        },
        /**
         * Tests: may use test utilities, but must still respect the layer boundaries of the module they test.
         * Must come after the production overrides, as later overrides replace the rule options.
         */
        {
            files: testFiles,
            rules: {
                'vitest/expect-expect': [
                    'error',
                    {
                        assertFunctionNames: [
                            'expect',
                            'expectTypeOf',
                            'assert',
                            'assertType',
                            'expectHas',
                            'expectIs',
                        ],
                    },
                ],
                'typescript/explicit-function-return-type': 'off',
                'no-console': 'off',
                'no-restricted-imports': 'off',
            },
        },
        {
            files: ['src/fhir/**/*.test.ts', 'src/fhir/**/__tests__/**/*.ts'],
            rules: { 'no-restricted-imports': restrict('/fhir tests', ['smart', 'test']) },
        },
        {
            files: ['src/zod/**/*.test.ts'],
            rules: { 'no-restricted-imports': restrict('/zod tests', ['smart', 'fhir', 'test']) },
        },
        {
            files: ['src/internal/**/*.test.ts'],
            rules: { 'no-restricted-imports': restrict('/internal tests', ['smart', 'fhir', 'zod', 'test']) },
        },
    ],
})
