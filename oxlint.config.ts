import { defineConfig } from 'oxlint'

export default defineConfig({
    categories: {
        correctness: 'error',
    },
    options: {
        // TODO: Enable this, they are good
        typeAware: true,
        typeCheck: true,
    },
    ignorePatterns: ['docs/.vitepress/**'],
})
