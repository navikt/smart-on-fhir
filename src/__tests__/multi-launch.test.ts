import { expect, test } from 'vitest'

import { ReadyClient } from '../client'

import { mockTokenExchange } from './mocks/auth'
import { mockSmartConfiguration } from './mocks/issuer'
import { createMultiLaunchTestClient, TEST_SESSION_ID } from './utils/client'
import { expectHas, expectIs } from './utils/expect'

test.fails('launching multiple patients within same session should be supported', async () => {
    const firstLaunch = await fullLaunch('patient-zero')
    expect(firstLaunch.patient.id).toBe('patient-zero')

    const secondLaunch = await fullLaunch('patient-one')
    expect(secondLaunch.patient.id).toBe('patient-one')

    {
        const [client] = createMultiLaunchTestClient('patient-zero')
        const ready = await client.ready()
        expectIs(ready, ReadyClient)

        expect(ready.patient.id).toBe('patient-zero')
    }
    {
        const [client] = createMultiLaunchTestClient('patient-one')
        const ready = await client.ready()
        expectIs(ready, ReadyClient)

        expect(ready.patient.id).toBe('patient-one')
    }
})

async function fullLaunch(patient: string): Promise<ReadyClient> {
    // Launch is inherently activePatient-less
    const [client, storage] = createMultiLaunchTestClient(null)

    mockSmartConfiguration()
    const result = await client.launch({
        launch: 'test-launch',
        iss: 'http://fhir-server',
    })
    expectHas(result, 'redirectUrl')

    const firstLaunchPartialSession = await storage.getPartial(TEST_SESSION_ID)
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
