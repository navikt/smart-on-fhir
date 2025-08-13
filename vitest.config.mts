import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        setupFiles: ['src/__tests__/utils/setup.ts'],
        include: ['src/__tests__/**/*.test.ts'],
        reporters: ['default', 'json'],
        outputFile: {
            json: 'vitest-report.json',
        },
        coverage: {
            include: ['src/**'],
        },
    },
    define: {
        LIB_VERSION: JSON.stringify('x.x.x-tests'),
    },
})
