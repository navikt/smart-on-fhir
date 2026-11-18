import tsm from '@navikt/tsm-oxlint'
import { defineConfig } from 'oxlint'

export default defineConfig({
    extends: [tsm],
    plugins: ['vitest'],
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: ['docs/.vitepress/**'],
    overrides: [
        {
            files: ['src/fhir/**/*.ts'],
            rules: {
                'no-restricted-imports': [
                    'error',
                    {
                        patterns: [
                            {
                                group: ['**/smart', '**/smart/**', '@navikt/smart-on-fhir/smart'],
                                message: '/fhir must not depend on /smart (only smart → fhir is allowed).',
                            },
                        ],
                    },
                ],
            },
        },
        {
            files: ['src/zod/**/*.ts'],
            rules: {
                'no-restricted-imports': [
                    'error',
                    {
                        patterns: [
                            {
                                group: ['**/smart', '**/smart/**', '@navikt/smart-on-fhir/smart'],
                                message: '/zod must not depend on /smart (only smart → zod is allowed).',
                            },
                            {
                                group: ['**/fhir', '**/fhir/**', '@navikt/smart-on-fhir/fhir'],
                                message: '/zod must not depend on /fhir (only fhir → zod is allowed).',
                            },
                        ],
                    },
                ],
            },
        },
        {
            files: ['src/lib/**/*.ts'],
            rules: {
                'no-restricted-imports': [
                    'error',
                    {
                        patterns: [
                            {
                                group: ['**/smart', '**/smart/**', '@navikt/smart-on-fhir/smart'],
                                message: '/lib must not depend on /smart (only smart → lib is allowed).',
                            },
                            {
                                group: ['**/fhir', '**/fhir/**', '@navikt/smart-on-fhir/fhir'],
                                message: '/lib must not depend on /fhir (only fhir → lib is allowed).',
                            },
                        ],
                    },
                ],
            },
        },
        {
            files: ['src/**/*.test.{ts,tsx}', 'src/internal/test-utils/**/*.ts'],
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
            },
        },
    ],
})
