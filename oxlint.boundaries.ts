/**
 * Module hierarchy, a layer may only import from layers below it:
 *
 *   test (public mocks) → smart → fhir → zod → internal
 *
 * Every layer can be imported both via tsconfig path aliases (#smart/*, #fhir/*, ...) and via relative
 * paths, so each restriction lists both forms.
 */
const layer = {
    smart: ['#smart/**', '**/smart', '**/smart/**', '@navikt/smart-on-fhir/smart'],
    fhir: ['#fhir/**', '**/fhir', '**/fhir/**', '@navikt/smart-on-fhir/fhir'],
    zod: ['#zod', '**/zod', '**/zod/**', '@navikt/smart-on-fhir/zod'],
    test: ['**/test', '**/test/**', '@navikt/smart-on-fhir/test'],
    testUtils: ['#test-utils/**', '**/__tests__', '**/__tests__/**'],
} as const

export type Layer = keyof typeof layer

export const restrict = (
    from: string,
    disallowed: Layer[],
): ['error', { patterns: { group: string[]; message: string }[] }] => [
    'error',
    {
        patterns: disallowed.map((target) => ({
            group: [...layer[target]],
            message:
                target === 'testUtils'
                    ? `${from} must not depend on test utilities (__tests__ / #test-utils).`
                    : `${from} must not depend on /${target} (hierarchy: test → smart → fhir → zod → internal).`,
        })),
    },
]
