export default {
    '*.{js,ts,cjs,mjs,d.cts,d.mts,jsx,tsx,json,jsonc}': ['yarn fmt', 'yarn lint:fix'],
    '*.{ts,tsx}': () => ['yarn tsc'],
}
