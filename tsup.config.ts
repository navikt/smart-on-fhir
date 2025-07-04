import { defineConfig } from 'tsup'

export default defineConfig({
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    metafile: true,
    entry: ['src/zod/index.ts', 'src/client/index.ts'],
})
