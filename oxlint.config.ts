import tsm from '@navikt/tsm-oxlint'
import { defineConfig } from 'oxlint'

export default defineConfig({
    extends: [tsm],
    plugins: ['vitest'],
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: ['docs/.vitepress/**'],
    overrides: [
        {
            files: ['src/__tests__/**/*.{ts,tsx}'],
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
