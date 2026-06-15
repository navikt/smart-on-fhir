import config from '@navikt/tsm-oxfmt'
import { defineConfig } from 'oxfmt'

export default defineConfig({
    ...config,
    sortImports: {
        newlinesBetween: true,
        groups: [
            // [":NODE:", ":PACKAGE:"]
            ['builtin', 'external'],
            // :ALIAS:
            'internal',
            // ../**
            'parent',
            // ./**
            'sibling',
            // ./index
            'index',
        ],
    },
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
