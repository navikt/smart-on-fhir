import { defineConfig } from 'oxlint'

export default defineConfig({
    categories: {
        correctness: 'error',
    },
    options: {
        // TODO: Enable this, they are good
        typeAware: false,
        typeCheck: false,
    },
    ignorePatterns: ['docs/.vitepress/**'],
})
