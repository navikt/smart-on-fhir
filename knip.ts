import type { KnipConfig } from 'knip'

const config: KnipConfig = {
    ignore: ['docs/.vitepress/**'],
    ignoreDependencies: ['vitepress-plugin-npm-commands', 'vitepress-plugin-tabs', 'vue'],
}

export default config
