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
            { text: 'Docs', link: '/docs' },
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
                        text: 'SmartClient configuration',
                        link: '/your-first-launch#setting-up-the-smartclient',
                    },
                    {
                        text: 'Launching',
                        link: '/your-first-launch#launching',
                        collapsed: true,
                        items: [
                            { text: '/fhir/launch', link: '/your-first-launch#initial-launch-fhir-launch' },
                            { text: '/fhir/callback', link: '/your-first-launch#callback-fhir-callback' },
                            { text: 'Ready!', link: '/your-first-launch#ready' },
                        ],
                    },
                ],
            },
            {
                text: 'Docs',
                items: [
                    {
                        text: 'SmartClient',
                        link: '/docs/smart-client',
                        collapsed: true,
                        items: [
                            { text: 'SmartStorage', link: '/docs/smart-storage' },
                            { text: 'SmartClientConfiguration', link: '/docs/smart-client-configuration' },
                            { text: 'SmartClientOptions', link: '/docs/smart-client-options' },
                        ],
                    },
                    { text: 'ReadyClient', link: '/docs/ready-client' },
                    { text: 'SmartStorage', link: '/docs/smart-storage' },
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
