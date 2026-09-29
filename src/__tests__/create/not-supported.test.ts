import nock from 'nock'
import { expect, test } from 'vitest'

import type { FhirDocumentReference } from '../../zod'
import { FHIR_SERVER } from '../mocks/common'
import { justOpenReadyClient } from '../utils/client-open'

const payload: FhirDocumentReference = {
    resourceType: 'DocumentReference',
} as FhirDocumentReference

for (const status of [404, 405, 501]) {
    test(`SmartClient.create - ${status} on POST is reported as CREATE_FAILED_NOT_SUPPORTED`, async () => {
        const [ready] = await justOpenReadyClient()

        nock(FHIR_SERVER).post('/DocumentReference').reply(status, {})

        const result = await ready.create('DocumentReference', { payload })

        expect(result).toMatchObject({ error: 'CREATE_FAILED_NOT_SUPPORTED' })
    })

    test(`SmartClient.update - ${status} on PUT is reported as CREATE_FAILED_NOT_SUPPORTED`, async () => {
        const [ready] = await justOpenReadyClient()

        nock(FHIR_SERVER).put('/DocumentReference/sykmelding-1').reply(status, {})

        const result = await ready.update('DocumentReference', { id: 'sykmelding-1', payload })

        expect(result).toMatchObject({ error: 'CREATE_FAILED_NOT_SUPPORTED' })
    })
}

test('SmartClient.create - 500 on POST keeps CREATE_FAILED_NON_OK_RESPONSE', async () => {
    const [ready] = await justOpenReadyClient()

    nock(FHIR_SERVER).post('/DocumentReference').reply(500, {})

    const result = await ready.create('DocumentReference', { payload })

    expect(result).toMatchObject({ error: 'CREATE_FAILED_NON_OK_RESPONSE' })
})

test('SmartClient.update - 500 on PUT keeps CREATE_FAILED_NON_OK_RESPONSE', async () => {
    const [ready] = await justOpenReadyClient()

    nock(FHIR_SERVER).put('/DocumentReference/sykmelding-1').reply(500, {})

    const result = await ready.update('DocumentReference', { id: 'sykmelding-1', payload })

    expect(result).toMatchObject({ error: 'CREATE_FAILED_NON_OK_RESPONSE' })
})
