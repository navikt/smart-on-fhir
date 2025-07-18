import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
    title: '@navikt/smart-on-fhir',
    description: 'Getting started with server-first Smart on FHIR client',
    base: '/smart-on-fhir/',
    themeConfig: {
        // https://vitepress.dev/reference/default-theme-config
        nav: [
            { text: 'Home', link: '/' },
            { text: 'Examples', link: '/markdown-examples' },
        ],

        sidebar: [
            {
                text: 'Examples',
                items: [
                    { text: 'Markdown Examples', link: '/markdown-examples' },
                    { text: 'Runtime API Examples', link: '/api-examples' },
                ],
            },
        ],

        socialLinks: [{ icon: 'github', link: 'https://github.com/navikt/smart-on-fhir' }],
    },
    transformHead({ assets }) {
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
