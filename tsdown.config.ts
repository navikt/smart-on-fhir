import { defineConfig } from 'tsdown'

import pkgJson from './package.json' with { type: 'json' }

export default defineConfig({
    dts: true,
    sourcemap: true,
    entry: ['src/zod/index.ts', 'src/client/index.ts'],
    define: { LIB_VERSION: JSON.stringify(pkgJson.version) },
    target: false,
})
