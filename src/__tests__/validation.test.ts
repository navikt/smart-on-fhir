import { expect, test } from 'vitest'

import { ReadyClient } from '../client'
import type { CompleteSession } from '../client/storage/schema'

import { AUTH_SERVER, FHIR_SERVER } from './mocks/common'
import { mockJwks, mockSmartConfiguration } from './mocks/issuer'
import { createLaunchableSmartClient } from './utils/client'
import { expectIs } from './utils/expect'
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

test('.validate - should properly validate token', async () => {
    const [client] = await createLaunchableSmartClient({
        ...validSession,
        accessToken: await createTestAccessToken(60 * 10), // 10 minutes
    })

    const ready = await client.ready()
    expectIs(ready, ReadyClient)

    mockSmartConfiguration()
    mockJwks()
    const validToken = await ready.validate()

    expect(validToken).toBe(true)
})

test('.validate - should not validate expired token', async () => {
    const [client] = await createLaunchableSmartClient({
        ...validSession,
        accessToken: await createTestAccessToken(-60), // 1 minute expired
    })

    const ready = await client.ready()
    expectIs(ready, ReadyClient)

    mockSmartConfiguration()
    mockJwks()
    const validToken = await ready.validate()

    expect(validToken).toBe(false)
})

test('.validate - should not validate garbage', async () => {
    const [client] = await createLaunchableSmartClient({
        ...validSession,
        accessToken: 'straight.up.garbage',
    })

    const ready = await client.ready()
    expectIs(ready, ReadyClient)

    mockSmartConfiguration()
    mockJwks()
    const validToken = await ready.validate()

    expect(validToken).toBe(false)
})
