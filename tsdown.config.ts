import { defineConfig } from 'tsdown'

import pkgJson from './package.json' with { type: 'json' }

export default defineConfig({
    dts: true,
    sourcemap: true,
    entry: ['src/zod/index.ts', 'src/smart/index.ts', 'src/fhir/index.ts', 'src/test/index.ts'],
    deps: { onlyBundle: [] },
    define: { LIB_VERSION: JSON.stringify(pkgJson.version) },
    target: false,
})
