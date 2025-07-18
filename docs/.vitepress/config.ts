import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
    title: '@navikt/smart-on-fhir',
    description: 'Getting started with server-first Smart on FHIR client',
    base: '/smart-on-fhir/',
    themeConfig: {
        // https://vitepress.dev/reference/default-theme-config
        nav: [
            { text: 'Getting started', link: '/getting-started' },
            { text: 'Docs', link: '/docs' },
        ],

        sidebar: [
            {
                text: 'Getting started',
                link: '/getting-started',
            },
            {
                text: 'Docs',
                link: '/docs',
                items: [
                    { text: 'SmartClient', link: '/docs/smart-client' },
                    { text: 'ReadyClient', link: '/docs/ready-client' },
                ],
            },
        ],

        socialLinks: [{ icon: 'github', link: 'https://github.com/navikt/smart-on-fhir' }],
    },
    transformHead() {
        return [
            [
                'link',
                {
                    rel: 'preload',
                    href: 'https://cdn.nav.no/aksel/fonts/SourceSans3-normal.woff2',
                    as: 'font',
                    type: 'font/woff2',
                    crossorigin: '',
                },
            ],
        ]
    },
})
