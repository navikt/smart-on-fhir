import nock from 'nock'
import { expect, test } from 'vitest'

import type { CompleteSession } from '../client/storage/schema'

import { AUTH_SERVER, FHIR_SERVER } from './mocks/common'
import { createLaunchedOpenReadyClient } from './utils/client-open'
import { expectHas } from './utils/expect'
import { createTestIdToken } from './utils/token'

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

const operationOutcome = {
    resourceType: 'OperationOutcome',
    id: 'a95b1c8b-9a0e-4a4f-8d3f-3f6a1a4e2b71',
    meta: {
        lastUpdated: '2026-02-16T14:11:13.6531423+00:00',
    },
    issue: [
        {
            severity: 'information',
            code: 'not-supported',
            diagnostics: 'QuestionnaireResponse is not implemented on this server',
        },
    ],
}

test('SmartClient.request - 404 preserves the OperationOutcome instead of discarding it', async () => {
    const [ready] = await createLaunchedOpenReadyClient(validSession)

    const mock = nock(FHIR_SERVER)
        .get('/QuestionnaireResponse/sykmelding-1')
        .reply(404, operationOutcome, { 'Content-Type': 'application/fhir+json' })

    const result = await ready.request('QuestionnaireResponse/sykmelding-1', { expectNotFound: true })

    expect(mock.isDone()).toBe(true)
    expectHas(result, 'error')
    expectHas(result, 'operationOutcome')
    expect(result).toMatchObject({
        error: 'REQUEST_FAILED_RESOURCE_NOT_FOUND',
        operationOutcome,
    })
})
