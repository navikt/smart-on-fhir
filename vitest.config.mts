import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        setupFiles: ['src/__tests__/setup.ts'],
        include: ['src/**/*.test.ts'],
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
