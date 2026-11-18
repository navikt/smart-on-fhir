import nock from 'nock'
import { expect, test } from 'vitest'

import { FHIR_SERVER } from '#test-utils/mocks'
import type { FhirDocumentReference } from '#zod'

import { createOpenFhirClient } from './utils/fhir-client-open'

const payload: FhirDocumentReference = {
    resourceType: 'DocumentReference',
} as FhirDocumentReference

for (const status of [404, 405, 501]) {
    test(`FhirClient.create - ${status} on POST is reported as CREATE_FAILED_NOT_SUPPORTED`, async () => {
        const fhir = createOpenFhirClient()

        nock(FHIR_SERVER).post('/DocumentReference').reply(status, {})

        const result = await fhir.create('DocumentReference', { payload })

        expect(result).toMatchObject({ error: 'CREATE_FAILED_NOT_SUPPORTED' })
    })

    test(`FhirClient.update - ${status} on PUT is reported as CREATE_FAILED_NOT_SUPPORTED`, async () => {
        const fhir = createOpenFhirClient()

        nock(FHIR_SERVER).put('/DocumentReference/sykmelding-1').reply(status, {})

        const result = await fhir.update('DocumentReference', { id: 'sykmelding-1', payload })

        expect(result).toMatchObject({ error: 'CREATE_FAILED_NOT_SUPPORTED' })
    })
}

test('FhirClient.create - 500 on POST keeps CREATE_FAILED_NON_OK_RESPONSE', async () => {
    const fhir = createOpenFhirClient()

    nock(FHIR_SERVER).post('/DocumentReference').reply(500, {})

    const result = await fhir.create('DocumentReference', { payload })

    expect(result).toMatchObject({ error: 'CREATE_FAILED_NON_OK_RESPONSE' })
})

test('FhirClient.update - 500 on PUT keeps CREATE_FAILED_NON_OK_RESPONSE', async () => {
    const fhir = createOpenFhirClient()

    nock(FHIR_SERVER).put('/DocumentReference/sykmelding-1').reply(500, {})

    const result = await fhir.update('DocumentReference', { id: 'sykmelding-1', payload })

    expect(result).toMatchObject({ error: 'CREATE_FAILED_NON_OK_RESPONSE' })
})
