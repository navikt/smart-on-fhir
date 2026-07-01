import { expect, test } from 'vitest'

import type { CompleteSession } from '../../client/storage/schema'
import type { FhirBatchBundle } from '../../zod'
import { AUTH_SERVER, FHIR_SERVER } from '../mocks/common'
import { mockBatchBundle } from '../mocks/create-resources'
import { createLaunchedOpenReadyClient } from '../utils/client-open'
import { expectHas } from '../utils/expect'
import { createTestIdToken } from '../utils/token'

test('SmartClient.create - /Bundle', async () => {
    const [ready] = await createLaunchedOpenReadyClient(validSession)

    const testResources: FhirBatchBundle['entry'] = [
        {
            method: 'PUT',
            url: 'DocumentReference/0c3710bb-d3fb-4532-a88c-2615c298284f',
            resource: { resourceType: 'DocumentReference' },
        },
        {
            method: 'PUT',
            url: 'QuestionnaireResponse/0c3710bb-d3fb-4532-a88c-2615c298284f',
            resource: { resourceType: 'QuestionnaireResponse' },
        },
    ]

    const mock = mockBatchBundle(
        {
            resourceType: 'Bundle',
            type: 'batch',
            entry: testResources,
        },
        {
            resourceType: 'Bundle',
            type: 'batch-response',
            entry: testResources.map((entry) => ({
                response: { status: '200', location: entry.url },
            })),
        },
    )
    const batchResponse = await ready.batch(testResources)

    expect(mock.isDone()).toBe(true)
    expectHas(batchResponse, 'resourceType')
    expect(batchResponse.entry.map((it) => it.response.status)).toEqual(['200', '200'])
})

const validSession: CompleteSession = {
    // Initial
    fhirServer: FHIR_SERVER,
    tokenIssuer: AUTH_SERVER,
    jwksUri: `${AUTH_SERVER}/jwks`,
    introspectionEndpoint: `${AUTH_SERVER}/introspect`,
    authorizationEndpoint: `${AUTH_SERVER}/authorize`,
    tokenEndpoint: `${AUTH_SERVER}/token`,
    codeVerifier: 'valid-code-verifier',
    state: 'valid-state',
    // Completed
    accessToken: 'valid-access-token',
    idToken: await createTestIdToken({
        fhirUser: 'Practitioner/ac768edb-d56a-4304-8574-f866c6af4e7e',
    }),
    refreshToken: 'valid-refresh-token',
    patient: 'valid-patient-id',
    encounter: 'valid-encounter-id',
}
