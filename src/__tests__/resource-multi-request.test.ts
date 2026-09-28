import nock from 'nock'
import { expect, test } from 'vitest'

import { FHIR_SERVER } from './mocks/common'
import { mockPatient, mockPractitioner } from './mocks/resources'
import { justOpenReadyClient } from './utils/client-open'

test('multi should combine successful parallel resource requests', async () => {
    const [ready] = await justOpenReadyClient()

    mockPractitioner('ac768edb-d56a-4304-8574-f866c6af4e7e')
    mockPatient('valid-patient-id')

    const multiResult = await ready.multi({
        practitioner: ready.user.request(),
        patient: ready.patient.request(),
    })

    if (!multiResult.ok) {
        throw new Error(
            `Multi request failed: ${multiResult.failedResource.join(', ')}, ${multiResult.errors[0].error}`,
        )
    }

    expect(multiResult.practitioner.resourceType).toEqual('Practitioner')
    expect(multiResult.patient.resourceType).toEqual('Patient')
})

test('multi should combine errors when some resources fail', async () => {
    const [ready] = await justOpenReadyClient()

    // Patient succeeds, practitioner responds 404 -> combined into a single failure.
    mockPatient('valid-patient-id')
    nock(FHIR_SERVER).get('/Practitioner/ac768edb-d56a-4304-8574-f866c6af4e7e').reply(404)

    const multiResult = await ready.multi({
        practitioner: ready.user.request(),
        patient: ready.patient.request(),
    })

    expect(multiResult.ok).toBe(false)

    if (multiResult.ok) {
        throw new Error('Expected multi request to fail')
    }

    expect(multiResult.failedResource).toEqual(['practitioner'])
    expect(multiResult.errors).toHaveLength(1)
    expect(multiResult.errors[0].error).toContain('REQUEST_FAILED')
    // The successful resource is still available for inspection via the result map.
    expect(multiResult.results.patient).not.toHaveProperty('error')
})
