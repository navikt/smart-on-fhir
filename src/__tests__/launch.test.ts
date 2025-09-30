import { expect, test } from 'vitest'

import { ReadyClient, SmartClient, type SmartClientOptions, type SmartStorage } from '../client'
import { safeSmartStorage } from '../client/storage'

import { mockTokenExchange } from './mocks/auth'
import { fhirNock, mockSmartConfiguration } from './mocks/issuer'
import { TEST_SESSION_ID } from './utils/client-open'
import { expectHas, expectIs } from './utils/expect'
import { createMockedStorage, createTestStorage } from './utils/storage'

test('.launch - should fetch well-known and create a launch URL', async () => {
    const storage = createMockedStorage()
    const client = createSmartClient(storage)

    const smartConfigNock = mockSmartConfiguration()
    const result = await client.launch({
        launch: 'test-launch',
        iss: 'http://fhir-server',
    })

    expect(smartConfigNock.isDone()).toBe(true)

    /**
     * Should store partial session in the storage
     */
    expect(storage.setFn).toHaveBeenCalledWith(TEST_SESSION_ID, {
        issuer: 'http://fhir-server',
        authorizationEndpoint: 'http://auth-server/authorize',
        tokenEndpoint: 'http://auth-server/token',
        server: 'http://fhir-server',
        codeVerifier: expect.any(String),
        state: expect.any(String),
    })

    /**
     * Should create a redirect URL with PKCE and state
     */
    expectHas(result, 'redirectUrl')
    const params = Object.fromEntries(new URL(result.redirectUrl).searchParams.entries())
    expect(params).toEqual({
        client_id: 'test-client',
        code_challenge_method: 'S256',
        redirect_uri: 'http://app/callback',
        aud: 'http://fhir-server',
        launch: 'test-launch',
        response_type: 'code',
        scope: 'openid fhirUser launch/patient',
        code_challenge: expect.any(String),
        state: expect.any(String),
    })
})

test('.launch - should gracefully handle well-known not responding correctly', async () => {
    const storage = createMockedStorage()
    const client = createSmartClient(storage)

    fhirNock().get('/.well-known/smart-configuration').reply(500, { hey_crashy: true })
    const result = await client.launch({
        launch: 'test-launch',
        iss: 'http://fhir-server',
    })

    expectHas(result, 'error')
    expect(result.error).toEqual('WELL_KNOWN_INVALID_RESPONSE')
})

test('.launch - should gracefully handle well-known responding with invalid payload', async () => {
    const storage = createMockedStorage()
    const client = createSmartClient(storage)

    fhirNock().get('/.well-known/smart-configuration').reply(200, { this_is_garbage: 'foo-bar-baz' })
    const result = await client.launch({
        launch: 'test-launch',
        iss: 'http://fhir-server',
    })

    expectHas(result, 'error')
    expect(result.error).toEqual('WELL_KNOWN_INVALID_BODY')
})

test('.callback should exchange code for token', async () => {
    const storage = createMockedStorage()
    storage.getFn.mockImplementationOnce(() => ({
        server: 'http://fhir-server',
        issuer: 'http://auth-server',
        authorizationEndpoint: 'http://auth-server/authorize',
        tokenEndpoint: 'http://auth-server/token',
        codeVerifier: 'test-code-verifier',
        state: 'some-value',
    }))
    const client = createSmartClient(storage)

    const tokenResponseNock = await mockTokenExchange({
        client_id: 'test-client',
        code: 'køde',
        code_verifier: 'test-code-verifier',
        redirect_uri: 'http://app/callback',
    })

    const callback = await client.callback({
        state: 'some-value',
        code: 'køde',
    })

    expect(tokenResponseNock.isDone()).toBe(true)
    expectHas(callback, 'redirectUrl')
    expect(callback.redirectUrl).toBe('http://app/redirect')
})

test('.callback should gracefully handle state mismatch', async () => {
    const storage = createMockedStorage()
    storage.getFn.mockImplementationOnce(() => ({
        server: 'http://fhir-server',
        issuer: 'http://auth-server',
        authorizationEndpoint: 'http://auth-server/authorize',
        tokenEndpoint: 'http://auth-server/token',
        codeVerifier: 'test-code-verifier',
        state: 'this-expected-value',
    }))
    const client = createSmartClient(storage)

    await mockTokenExchange({
        client_id: 'test-client',
        code: 'køde',
        code_verifier: 'test-code-verifier',
        redirect_uri: 'http://app/callback',
    })

    const callback = await client.callback({
        state: 'other-wrong-value',
        code: 'køde',
    })

    expectHas(callback, 'error')
    expect(callback.error).toBe('INVALID_STATE')
})

test('.callback should redirect with patient ID when enableMultiLaunch=true', async () => {
    const storage = createMockedStorage()
    storage.getFn.mockImplementationOnce(() => ({
        server: 'http://fhir-server',
        issuer: 'http://auth-server',
        authorizationEndpoint: 'http://auth-server/authorize',
        tokenEndpoint: 'http://auth-server/token',
        codeVerifier: 'test-code-verifier',
        state: 'some-value',
    }))
    const client = createSmartClient(storage, { enableMultiLaunch: true })

    const tokenResponseNock = await mockTokenExchange({
        client_id: 'test-client',
        code: 'køde',
        code_verifier: 'test-code-verifier',
        redirect_uri: 'http://app/callback',
    })

    const callback = await client.callback({
        state: 'some-value',
        code: 'køde',
    })

    expect(tokenResponseNock.isDone()).toBe(true)
    expectHas(callback, 'redirectUrl')
    expect(callback.redirectUrl).toBe('http://app/redirect?patient=c4664cf0-9168-4b6f-8798-93799068552b')
})

test('full simulated launch flow, .ready() → .callback() → .ready()', async () => {
    const storage = createTestStorage()
    const client = new SmartClient(
        TEST_SESSION_ID,
        {
            clientId: 'test-client',
            scope: 'openid fhirUser launch/patient',
            callbackUrl: 'http://app/callback',
            redirectUrl: 'http://app/redirect',
            knownFhirServers: [
                {
                    name: 'TestMed',
                    issuer: 'http://fhir-server',
                    type: 'public',
                },
            ],
        },
        { storage },
    )

    /**
     * .launch(), create authorization URL and prepare initial session
     */
    mockSmartConfiguration()
    const result = await client.launch({
        launch: 'test-launch',
        iss: 'http://fhir-server',
    })
    expectHas(result, 'redirectUrl')

    /**
     * The user would normally be redirected to the authorization URL, and then
     * the authorization server would redirect back to the app with a code. For testing
     * purposes we skip this step.
     */
    const safeStorage = safeSmartStorage(storage)
    const state = new URL(result.redirectUrl).searchParams.get('state') as string
    const firstLaunchPartialSession = await safeStorage.getPartial(TEST_SESSION_ID)
    expectHas(firstLaunchPartialSession, 'codeVerifier')

    await mockTokenExchange({
        client_id: 'test-client',
        code: 'mock-code',
        code_verifier: firstLaunchPartialSession.codeVerifier,
        redirect_uri: 'http://app/callback',
    })

    /**
     * .callback() should exchange the code for tokens and return a redirect URL to the final URL
     */
    const callback = await client.callback({ state, code: 'mock-code' })
    expectHas(callback, 'redirectUrl')

    /**
     * .ready() should return a ReadyClient with the active patient
     */
    const readyClient = await client.ready()

    expectIs(readyClient, ReadyClient)
    expect(readyClient.patient.reference).toEqual('Patient/c4664cf0-9168-4b6f-8798-93799068552b')
    expect(readyClient.user.fhirUser).toEqual('Practitioner/71503542-c4f5-4f11-a5a5-6633c139d0d4')
    expect(readyClient.issuerName).toEqual('TestMed')
})

function createSmartClient(storage: SmartStorage, options?: SmartClientOptions & { enableMultiLaunch?: true }) {
    return new SmartClient(
        TEST_SESSION_ID,
        {
            clientId: 'test-client',
            scope: 'openid fhirUser launch/patient',
            callbackUrl: 'http://app/callback',
            redirectUrl: 'http://app/redirect',
            allowAnyIssuer: true,
        },
        { storage, options },
    )
}
