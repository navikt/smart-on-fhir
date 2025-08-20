import { expect, test } from 'vitest'

import { inferResourceType } from '../../client/smart/lib/utils'

test.each([
    { path: '/Patient/123', expected: 'Patient' },
    { path: '/DocumentReference/456', expected: 'DocumentReference' },
    { path: '/DocumentReference', expected: 'DocumentReference' },
    { path: '/DocumentReference?oogli-boogli=joda-neida-så-det', expected: 'DocumentReference' },
    { path: '/Observation/789', expected: 'Observation' },
    { path: '/Encounter/321', expected: 'Encounter' },
    { path: '/Condition/654', expected: 'Condition' },
    { path: '/Patient', expected: 'Patient' },
    { path: '/Condition?patient=123', expected: 'Condition' },
])('inferResourceType: $path → $expected', ({ path, expected }) => {
    expect(inferResourceType(path)).toBe(expected)
})
