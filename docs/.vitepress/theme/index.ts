import DefaultTheme from 'vitepress/theme'
import { enhanceAppWithTabs } from 'vitepress-plugin-tabs/client'

import './aksel/tokens.css'
import './aksel/fonts.css'
import './aksel/baseline.css'
import './aksel/reset.css'

import './custom.css'

export default {
    extends: DefaultTheme,
    enhanceApp({ app }) {
        enhanceAppWithTabs(app)
    },
}
