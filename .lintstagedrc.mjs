export default {
    '*.{js,ts,cjs,mjs,d.cts,d.mts,jsx,tsx,json,jsonc}': [
        'biome check --write --no-errors-on-unmatched',
        'biome lint --write --no-errors-on-unmatched',
    ],
    '*.{ts,tsx}': () => ['yarn tsc'],
}
