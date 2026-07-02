import { defineConfig } from 'oxlint'

export default defineConfig({
    plugins: ['oxc', 'typescript', 'unicorn', 'vitest', 'import'],
    options: { typeAware: true, typeCheck: true },
    rules: {
        'no-console': 'warn',
        'no-unused-expressions': 'warn',
        'no-array-constructor': 'warn',
        'typescript/no-explicit-any': 'warn',
        'typescript/no-require-imports': 'warn',
        'typescript/ban-ts-comment': ['warn', { 'ts-expect-error': 'allow-with-description' }],
        'typescript/no-non-null-assertion': 'warn',
        'typescript/no-unsafe-function-type': 'warn',
        'typescript/no-empty-object-type': 'warn',
        'typescript/no-unnecessary-type-constraint': 'warn',
        'typescript/explicit-function-return-type': ['warn', { allowExpressions: true }],
    },
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
