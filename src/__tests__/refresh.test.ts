import nock from 'nock'
import { expect, test } from 'vitest'

import { ReadyClient } from '../client'
import type { CompleteSession } from '../client/storage/schema'

import { mockTokenRefresh } from './mocks/auth'
import { AUTH_SERVER, FHIR_SERVER } from './mocks/common'
import { mockCreateDocumentReference, mockUpdateDocumentReference } from './mocks/create-resources'
import { mockPractitioner } from './mocks/resources'
import { createLaunchableSmartClient, createLaunchedReadyClient } from './utils/client'
import { expectHas, expectIs } from './utils/expect'
import { createTestAccessToken, createTestIdToken } from './utils/token'

const validSession: CompleteSession = {
    // Initial
    server: FHIR_SERVER,
    issuer: AUTH_SERVER,
    authorizationEndpoint: `${AUTH_SERVER}/authorize`,
    tokenEndpoint: `${AUTH_SERVER}/token`,
    codeVerifier: 'valid-code-verifier',
    state: 'valid-state',
    // Completed
    accessToken: await createTestAccessToken(3600),
    idToken: await createTestIdToken({
        fhirUser: 'Practitioner/ac768edb-d56a-4304-8574-f866c6af4e7e',
    }),
    refreshToken: 'valid-refresh-token',
    patient: 'valid-patient-id',
    encounter: 'valid-encounter-id',
}

test('.ready - should not refresh token when expiry is more than 5 minutes', async () => {
    const [client] = await createLaunchableSmartClient(
        {
            ...validSession,
            accessToken: await createTestAccessToken(60 * 6), // 6 minutes
        },
        { autoRefresh: true },
    )

    const tokenMock = nock(AUTH_SERVER).post('/token').replyWithError('This endpoint should not be called')

    const ready = await client.ready()

    expectIs(ready, ReadyClient)

    expect(tokenMock.pendingMocks()).toContain(`POST ${AUTH_SERVER}:80/token`)
})

test('.ready - should refresh token when expiry is less than 5 minutes', async () => {
    const [client] = await createLaunchableSmartClient(
        {
            ...validSession,
            accessToken: await createTestAccessToken(60 * 4.99),
        },
        { autoRefresh: true },
    )

    await mockTokenRefresh({
        client_id: 'test-client',
        refresh_token: 'valid-refresh-token',
    })

    const ready = await client.ready()

    expectIs(ready, ReadyClient)
})

test('.ready - should refresh token when expiry is long ago', async () => {
    const [client] = await createLaunchableSmartClient(
        {
            ...validSession,
            accessToken: await createTestAccessToken(-60 * 10), // 10 minutes ago
        },
        { autoRefresh: true },
    )

    await mockTokenRefresh({
        client_id: 'test-client',
        refresh_token: 'valid-refresh-token',
    })

    const ready = await client.ready()

    expectIs(ready, ReadyClient)
})

test('SmartClient.request - Should refresh token when server says 401', async () => {
    const [ready] = await createLaunchedReadyClient(validSession, {
        autoRefresh: true,
    })

    // First request should fail with 401 Unauthorized
    const practitionerUnauthorized = nock('http://fhir-server')
        .get(`/Practitioner/ac768edb-d56a-4304-8574-f866c6af4e7e`)
        .reply(401)

    // We then expect the token to be refreshed
    const tokenMock = await mockTokenRefresh({
        client_id: 'test-client',
        refresh_token: 'valid-refresh-token',
    })

    // And finally, the request should succeed with the refreshed token
    const practitionerActual = mockPractitioner('ac768edb-d56a-4304-8574-f866c6af4e7e')

    const practitioner = await ready.request(ready.user.fhirUser)

    expect(practitionerUnauthorized.isDone()).toBe(true)
    expect(practitionerActual.isDone()).toBe(true)
    expect(tokenMock.isDone()).toBe(true)

    expectHas(practitioner, 'resourceType')
    expect(practitioner.resourceType).toBe('Practitioner')
})

test('SmartClient.create - Should refresh token when server says 401', async () => {
    const [ready] = await createLaunchedReadyClient(validSession, {
        autoRefresh: true,
    })

    // First request should fail with 401 Unauthorized
    const documentReferenceUnauthorized = nock('http://fhir-server').post(`/DocumentReference`).reply(401)

    // We then expect the token to be refreshed
    const tokenMock = await mockTokenRefresh({
        client_id: 'test-client',
        refresh_token: 'valid-refresh-token',
    })

    // And finally, the request should succeed with the refreshed token
    const documentReferenceActual = mockCreateDocumentReference({
        resourceType: 'DocumentReference',
    })

    const documentReference = await ready.create('DocumentReference', {
        // Payload is contrivedly small for test
        payload: { resourceType: 'DocumentReference' },
    })

    expect(documentReferenceUnauthorized.isDone()).toBe(true)
    expect(documentReferenceActual.isDone()).toBe(true)
    expect(tokenMock.isDone()).toBe(true)

    expectHas(documentReference, 'resourceType')
    expect(documentReference.resourceType).toBe('DocumentReference')
})

test('SmartClient.update - Should refresh token when server says 401', async () => {
    const [ready] = await createLaunchedReadyClient(validSession, {
        autoRefresh: true,
    })

    // First request should fail with 401 Unauthorized
    const documentReferenceUnauthorized = nock('http://fhir-server').put(`/DocumentReference/my-id`).reply(401)

    // We then expect the token to be refreshed
    const tokenMock = await mockTokenRefresh({
        client_id: 'test-client',
        refresh_token: 'valid-refresh-token',
    })

    // And finally, the request should succeed with the refreshed token
    const documentReferenceActual = mockUpdateDocumentReference('my-id', {
        resourceType: 'DocumentReference',
    })

    const documentReference = await ready.update('DocumentReference', {
        id: 'my-id',
        // Payload is contrivedly small for test
        payload: { resourceType: 'DocumentReference' },
    })

    expect(documentReferenceUnauthorized.isDone()).toBe(true)
    expect(documentReferenceActual.isDone()).toBe(true)
    expect(tokenMock.isDone()).toBe(true)

    expectHas(documentReference, 'resourceType')
    expect(documentReference.resourceType).toBe('DocumentReference')
})
