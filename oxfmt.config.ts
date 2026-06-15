import config from '@navikt/tsm-oxfmt'
import { defineConfig } from 'oxfmt'

export default defineConfig({
    ...config,
    overrides: [
        {
            files: ['*.md', '*.mdx'],
            options: {
                printWidth: 100,
                tabWidth: 2,
            },
        },
    ],
})
