export default {
    '*.{js,ts,cjs,mjs,d.cts,d.mts,jsx,tsx,json,jsonc}': 'yarn fmt',
    '*.{ts,tsx,js,jsx}': 'yarn lint:fix',
    '*.{ts,tsx}': () => ['yarn tsc'],
}
