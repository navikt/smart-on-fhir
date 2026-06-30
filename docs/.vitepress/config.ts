import { defineConfig } from 'vitepress'
import { npmCommandsMarkdownPlugin } from 'vitepress-plugin-npm-commands'
import { tabsMarkdownPlugin } from 'vitepress-plugin-tabs'

// https://vitepress.dev/reference/site-config
export default defineConfig({
    title: '@navikt/smart-on-fhir',
    description: 'Getting started with server-first Smart on FHIR client',
    base: '/smart-on-fhir/',
    themeConfig: {
        // https://vitepress.dev/reference/default-theme-config
        nav: [
            { text: 'Getting started', link: '/getting-started' },
            { text: 'Docs', link: '/docs/smart-client' },
        ],

        sidebar: [
            {
                text: 'Getting started',
                link: '/getting-started',
                items: [
                    { text: 'Prerequisites', link: '/getting-started#prerequisites' },
                    { text: 'Installing', link: '/getting-started#installing' },
                ],
            },
            {
                text: 'Your first launch',
                link: '/your-first-launch',
                items: [
                    {
                        text: '1. Setting up the SmartClient',
                        link: '/your-first-launch#setting-up-the-smartclient',
                    },
                    {
                        text: '2. Launching',
                        link: '/your-first-launch#launching',
                        items: [
                            { text: '3. /fhir/launch', link: '/your-first-launch#initial-launch-fhir-launch' },
                            { text: '4. /fhir/callback', link: '/your-first-launch#callback-fhir-callback' },
                        ],
                    },
                    { text: '5. Ready!', link: '/your-first-launch#ready' },
                ],
            },
            {
                text: 'Docs',
                items: [
                    {
                        text: 'SmartClient',
                        link: '/docs/smart-client',
                        items: [
                            { text: 'Client Configuration', link: '/docs/smart-client-configuration' },
                            {
                                text: 'Configuration and storage',
                                base: '/docs/options',
                                items: [
                                    {
                                        text: 'Storage',
                                        link: '/smart-storage',
                                    },
                                    {
                                        text: 'Options',
                                        link: '/client-options',
                                    },
                                    {
                                        text: 'Cache',
                                        link: '/cache-options',
                                    },
                                ],
                            },
                        ],
                    },
                    { text: 'ReadyClient', link: '/docs/ready-client' },
                ],
            },
        ],
        socialLinks: [{ icon: 'github', link: 'https://github.com/navikt/smart-on-fhir' }],
    },
    markdown: {
        config(md) {
            md.use(tabsMarkdownPlugin)
            md.use(npmCommandsMarkdownPlugin)
        },
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
