import nock from 'nock'
import { expect, test } from 'vitest'

import type { CompleteSession } from '../../client/storage/schema'
import type { FhirDocumentReference } from '../../zod'
import { AUTH_SERVER, FHIR_SERVER } from '../mocks/common'
import { createLaunchedOpenReadyClient } from '../utils/client-open'
import { createTestIdToken } from '../utils/token'

const validSession: CompleteSession = {
    fhirServer: FHIR_SERVER,
    tokenIssuer: AUTH_SERVER,
    jwksUri: `${AUTH_SERVER}/jwks`,
    introspectionEndpoint: `${AUTH_SERVER}/introspect`,
    authorizationEndpoint: `${AUTH_SERVER}/authorize`,
    tokenEndpoint: `${AUTH_SERVER}/token`,
    codeVerifier: 'valid-code-verifier',
    state: 'valid-state',
    accessToken: 'valid-access-token',
    idToken: await createTestIdToken({
        fhirUser: 'Practitioner/ac768edb-d56a-4304-8574-f866c6af4e7e',
    }),
    refreshToken: 'valid-refresh-token',
    patient: 'valid-patient-id',
    encounter: 'valid-encounter-id',
}

const payload: FhirDocumentReference = {
    resourceType: 'DocumentReference',
} as FhirDocumentReference

for (const status of [404, 405, 501]) {
    test(`SmartClient.create - ${status} on POST is reported as CREATE_FAILED_NOT_SUPPORTED`, async () => {
        const [ready] = await createLaunchedOpenReadyClient(validSession)

        nock(FHIR_SERVER).post('/DocumentReference').reply(status, {})

        const result = await ready.create('DocumentReference', { payload })

        expect(result).toMatchObject({ error: 'CREATE_FAILED_NOT_SUPPORTED' })
    })

    test(`SmartClient.update - ${status} on PUT is reported as CREATE_FAILED_NOT_SUPPORTED`, async () => {
        const [ready] = await createLaunchedOpenReadyClient(validSession)

        nock(FHIR_SERVER).put('/DocumentReference/sykmelding-1').reply(status, {})

        const result = await ready.update('DocumentReference', { id: 'sykmelding-1', payload })

        expect(result).toMatchObject({ error: 'CREATE_FAILED_NOT_SUPPORTED' })
    })
}

test('SmartClient.create - 500 on POST keeps CREATE_FAILED_NON_OK_RESPONSE', async () => {
    const [ready] = await createLaunchedOpenReadyClient(validSession)

    nock(FHIR_SERVER).post('/DocumentReference').reply(500, {})

    const result = await ready.create('DocumentReference', { payload })

    expect(result).toMatchObject({ error: 'CREATE_FAILED_NON_OK_RESPONSE' })
})

test('SmartClient.update - 500 on PUT keeps CREATE_FAILED_NON_OK_RESPONSE', async () => {
    const [ready] = await createLaunchedOpenReadyClient(validSession)

    nock(FHIR_SERVER).put('/DocumentReference/sykmelding-1').reply(500, {})

    const result = await ready.update('DocumentReference', { id: 'sykmelding-1', payload })

    expect(result).toMatchObject({ error: 'CREATE_FAILED_NON_OK_RESPONSE' })
})
