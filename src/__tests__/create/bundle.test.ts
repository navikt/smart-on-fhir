import { expect, test } from 'vitest'

import type { CompleteSession } from '../../client/storage/schema'
import type { FhirBatchBundle } from '../../zod'
import { AUTH_SERVER, FHIR_SERVER } from '../mocks/common'
import { mockBatchBundle } from '../mocks/create-resources'
import { createLaunchedOpenReadyClient } from '../utils/client-open'
import { expectHas } from '../utils/expect'
import { createTestIdToken } from '../utils/token'

test('SmartClient.batch - /Bundle with transaction', async () => {
    const [ready] = await createLaunchedOpenReadyClient(validSession)

    const testResources: FhirBatchBundle['entry'] = [
        {
            request: {
                method: 'PUT',
                url: 'DocumentReference/0c3710bb-d3fb-4532-a88c-2615c298284f',
                resource: { resourceType: 'DocumentReference' },
            },
        },
        {
            request: {
                method: 'PUT',
                url: 'QuestionnaireResponse/0c3710bb-d3fb-4532-a88c-2615c298284f',
                resource: { resourceType: 'QuestionnaireResponse' },
            },
        },
    ]

    const mock = mockBatchBundle(
        {
            resourceType: 'Bundle',
            type: 'transaction',
            entry: testResources,
        },
        {
            resourceType: 'Bundle',
            type: 'batch-response',
            entry: testResources.map((entry) => ({
                response: { status: '200', location: entry.request.url },
            })),
        },
    )
    const batchResponse = await ready.batch('transaction', testResources)

    expect(mock.isDone()).toBe(true)
    expectHas(batchResponse, 'resourceType')
    expect(batchResponse.entry.map((it) => it.response.status)).toEqual(['200', '200'])
})

test('SmartClient.batch - /Bundle with resources', async () => {
    const [ready] = await createLaunchedOpenReadyClient(validSession)

    const testResources: FhirBatchBundle['entry'] = [
        { request: { method: 'GET', url: 'Patient/ed7bcb23-400f-4748-9e2a-6151fb5d9285' } },
        { request: { method: 'GET', url: 'Practitioner/3234e8fb-f059-400b-8f2f-02c77cd70648' } },
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
            entry: [
                {
                    resource: { resourceType: 'Patient' },
                    response: { status: '200', location: 'Patient/ed7bcb23-400f-4748-9e2a-6151fb5d9285' },
                },
                {
                    resource: { resourceType: 'Practitioner' },
                    response: { status: '200', location: 'Practitioner/3234e8fb-f059-400b-8f2f-02c77cd70648' },
                },
            ],
        },
    )
    const batchResponse = await ready.batch('batch', testResources)

    expect(mock.isDone()).toBe(true)
    expectHas(batchResponse, 'resourceType')
    expect(batchResponse.entry.map((it) => it.response.status)).toEqual(['200', '200'])
    expect(batchResponse.entry.map((it) => it.resource)).toEqual([
        { resourceType: 'Patient' },
        { resourceType: 'Practitioner' },
    ])
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
