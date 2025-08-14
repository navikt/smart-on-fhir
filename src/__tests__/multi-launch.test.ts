import { expect, test } from 'vitest'

import { ReadyClient, SmartClient, type SmartStorage } from '../client'
import { safeSmartStorage } from '../client/storage'

import { mockTokenExchange } from './mocks/auth'
import { mockSmartConfiguration } from './mocks/issuer'
import { TEST_SESSION_ID } from './utils/client'
import { expectHas, expectIs } from './utils/expect'
import { createTestStorage } from './utils/storage'

test('launching multiple patients within same session should be supported', async () => {
    const storage = createTestStorage()

    const firstLaunch = await fullLaunch('patient-zero', storage)
    expect(firstLaunch.patient.id).toBe('patient-zero')

    const secondLaunch = await fullLaunch('patient-one', storage)
    expect(secondLaunch.patient.id).toBe('patient-one')

    {
        const client = createMultiLaunchTestClient('patient-zero', storage)
        const ready = await client.ready()
        expectIs(ready, ReadyClient)

        expect(ready.patient.id).toBe('patient-zero')
    }
    {
        const client = createMultiLaunchTestClient('patient-one', storage)
        const ready = await client.ready()
        expectIs(ready, ReadyClient)

        expect(ready.patient.id).toBe('patient-one')
    }
})

test('launching a single user in multi launch mode should work both with and without activePatient', async () => {
    const storage = createTestStorage()

    const firstLaunch = await fullLaunch('patient-zero', storage)
    expect(firstLaunch.patient.id).toBe('patient-zero')

    {
        const client = createMultiLaunchTestClient('patient-zero', storage)
        const ready = await client.ready()
        expectIs(ready, ReadyClient)

        expect(ready.patient.id).toBe('patient-zero')
    }
    {
        const client = createMultiLaunchTestClient(null, storage)
        const ready = await client.ready()
        expectIs(ready, ReadyClient)

        expect(ready.patient.id).toBe('patient-zero')
    }
})

test('launching multiple patients, should give the last launch when no activePatient param', async () => {
    const storage = createTestStorage()

    await fullLaunch('patient-zero', storage)
    await fullLaunch('patient-one', storage)
    await fullLaunch('patient-last', storage)

    const client = createMultiLaunchTestClient(null, storage)
    const ready = await client.ready()
    expectIs(ready, ReadyClient)

    expect(ready.patient.id).toBe('patient-last')
})

test('launching many patients, should ready correct patients ReadyClient', async () => {
    const storage = createTestStorage()

    await fullLaunch('patient-zero', storage)
    await fullLaunch('patient-one', storage)
    await fullLaunch('patient-two', storage)
    await fullLaunch('patient-three', storage)
    await fullLaunch('patient-four', storage)
    await fullLaunch('patient-last', storage)

    const client = createMultiLaunchTestClient('patient-three', storage)
    const ready = await client.ready()
    expectIs(ready, ReadyClient)

    expect(ready.patient.id).toBe('patient-three')
})

test('launching one, no id should still work', async () => {
    const storage = createTestStorage()

    await fullLaunch('patient-zero', storage)

    const client = createMultiLaunchTestClient(null, storage)
    const ready = await client.ready()
    expectIs(ready, ReadyClient)

    expect(ready.patient.id).toBe('patient-zero')
})

test('launching without multi-user should not find previous sessions', async () => {
    const createClient = () =>
        new SmartClient(TEST_SESSION_ID, storage, {
            clientId: 'test-client',
            scope: 'openid fhirUser launch/patient',
            callbackUrl: 'http://app/callback',
            redirectUrl: 'http://app/redirect',
            allowAnyIssuer: true,
        })
    const storage = createTestStorage()

    const firstLaunch = await fullLaunch('patient-zero', storage, createClient())
    expect(firstLaunch.patient.id).toBe('patient-zero')

    const secondLaunch = await fullLaunch('patient-one', storage, createClient())
    expect(secondLaunch.patient.id).toBe('patient-one')

    /**
     * Try to access the first launch data even though it was launched without enableMultiLaunch,
     * should fallback to the latest launch
     */
    const client = createMultiLaunchTestClient('patient-zero', storage)
    const ready = await client.ready()
    expectIs(ready, ReadyClient)

    expect(ready.patient.id).toBe('patient-one')
})

async function fullLaunch(patient: string, storage: SmartStorage, client?: SmartClient): Promise<ReadyClient> {
    // Launch is inherently activePatient-less
    client = client ?? createMultiLaunchTestClient(null, storage)

    const safeStorage = safeSmartStorage(storage)

    mockSmartConfiguration()
    const result = await client.launch({
        launch: 'test-launch',
        iss: 'http://fhir-server',
    })
    expectHas(result, 'redirectUrl')

    const firstLaunchPartialSession = await safeStorage.getPartial(TEST_SESSION_ID)
    expectHas(firstLaunchPartialSession, 'codeVerifier')

    await mockTokenExchange(
        {
            client_id: 'test-client',
            code: 'mock-code',
            code_verifier: firstLaunchPartialSession.codeVerifier,
            redirect_uri: 'http://app/callback',
        },
        { patient },
    )

    const state = new URL(result.redirectUrl).searchParams.get('state') as string
    const callback = await client.callback({ state, code: 'mock-code' })
    expectHas(callback, 'redirectUrl')

    const readyClient = await client.ready()
    expectIs(readyClient, ReadyClient)

    return readyClient
}

function createMultiLaunchTestClient(activePatient: string | null, storage: SmartStorage): SmartClient {
    return new SmartClient(
        { sessionId: TEST_SESSION_ID, activePatient },
        storage,
        {
            clientId: 'test-client',
            scope: 'openid fhirUser launch/patient',
            callbackUrl: 'http://app/callback',
            redirectUrl: 'http://app/redirect',
            allowAnyIssuer: true,
        },
        { enableMultiLaunch: true },
    )
}
