import { expect, test } from 'vitest'

import { SmartClient } from '../client'
import { safeSmartStorage } from '../client/storage'

import { mockTokenExchange } from './mocks/auth'
import { mockSmartConfiguration } from './mocks/issuer'
import { expectHas } from './utils/expect'
import { createMockedStorage, createTestStorage } from './utils/storage'

test('public, launch - should allow launches for known issuers', async () => {
    const storage = createMockedStorage()
    const client = new SmartClient(
        'test-session',
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

    mockSmartConfiguration()
    const result = await client.launch({
        launch: 'test-launch',
        iss: 'http://fhir-server',
    })

    expectHas(result, 'redirectUrl')
})

test('public, launch - should block launches for unknown issuers if allowAnyIssuer is not set (i.e.) has knownFhirServers', async () => {
    const storage = createMockedStorage()
    const client = new SmartClient(
        'test-session',
        {
            clientId: 'test-client',
            scope: 'openid fhirUser launch/patient',
            callbackUrl: 'http://app/callback',
            redirectUrl: 'http://app/redirect',
            knownFhirServers: [
                {
                    name: 'TestMed',
                    issuer: 'http://other-server',
                    type: 'public',
                },
            ],
        },
        { storage },
    )

    const result = await client.launch({
        launch: 'test-launch',
        iss: 'http://fhir-server',
    })

    expectHas(result, 'error')
    expect(result.error).toEqual('UNKNOWN_ISSUER')
})

test('confidential-symmentric, launch - should allow launches for known issuers', async () => {
    const storage = createMockedStorage()
    const client = new SmartClient(
        'test-session',
        {
            clientId: 'test-client',
            scope: 'openid fhirUser launch/patient',
            callbackUrl: 'http://app/callback',
            redirectUrl: 'http://app/redirect',
            knownFhirServers: [
                {
                    name: 'TestMed',
                    issuer: 'http://fhir-server',
                    type: 'confidential-symmetric',
                    method: 'client_secret_basic',
                    clientSecret: 'test-secret',
                },
            ],
        },
        { storage },
    )

    mockSmartConfiguration()
    const result = await client.launch({
        launch: 'test-launch',
        iss: 'http://fhir-server',
    })

    expectHas(result, 'redirectUrl')
})

test('confidential-symmentric, .ready() - should gracefully handle when issuer is not known', async () => {
    const TEST_SESSION_ID = 'test-session'
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
                    type: 'confidential-symmetric',
                    method: 'client_secret_basic',
                    clientSecret: 'test-secret',
                },
            ],
        },
        { storage },
    )

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

    const badClient = new SmartClient(
        TEST_SESSION_ID,
        {
            clientId: 'test-client',
            scope: 'openid fhirUser launch/patient',
            callbackUrl: 'http://app/callback',
            redirectUrl: 'http://app/redirect',
            knownFhirServers: [],
        },
        { storage },
    )

    const ready = await badClient.ready()

    expectHas(ready, 'error')
    expect(ready.error).toEqual('UNKNOWN_ISSUER')
})

test('confidential-symmentric, token - should set correct authorization headers when client_secret_basic', async () => {
    const storage = createMockedStorage()
    storage.getFn.mockImplementationOnce(() => ({
        server: 'http://fhir-server',
        issuer: 'http://auth-server',
        authorizationEndpoint: 'http://auth-server/authorize',
        tokenEndpoint: 'http://auth-server/token',
        codeVerifier: 'test-code-verifier',
        state: 'some-value',
    }))

    const client = new SmartClient(
        'test-session',
        {
            clientId: 'test-client',
            scope: 'openid fhirUser launch/patient',
            callbackUrl: 'http://app/callback',
            redirectUrl: 'http://app/redirect',
            knownFhirServers: [
                {
                    name: 'TestMed',
                    issuer: 'http://fhir-server',
                    type: 'confidential-symmetric',
                    method: 'client_secret_basic',
                    clientSecret: 'test-secret',
                },
            ],
        },
        { storage },
    )

    const tokenResponseNock = await mockTokenExchange(
        {
            client_id: 'test-client',
            code: 'køde',
            code_verifier: 'test-code-verifier',
            redirect_uri: 'http://app/callback',
        },
        {},
        `Basic ${Buffer.from('test-client:test-secret').toString('base64')}`,
    )
    const callback = await client.callback({
        state: 'some-value',
        code: 'køde',
    })

    expect(tokenResponseNock.isDone()).toBe(true)
    expectHas(callback, 'redirectUrl')
    expect(callback.redirectUrl).toBe('http://app/redirect')
})

test('confidential-symmentric, token - should set correct authorization property when client_secret_post', async () => {
    const storage = createMockedStorage()
    storage.getFn.mockImplementationOnce(() => ({
        server: 'http://fhir-server',
        issuer: 'http://auth-server',
        authorizationEndpoint: 'http://auth-server/authorize',
        tokenEndpoint: 'http://auth-server/token',
        codeVerifier: 'test-code-verifier',
        state: 'some-value',
    }))

    const client = new SmartClient(
        'test-session',
        {
            clientId: 'test-client',
            scope: 'openid fhirUser launch/patient',
            callbackUrl: 'http://app/callback',
            redirectUrl: 'http://app/redirect',
            knownFhirServers: [
                {
                    name: 'TestMed',
                    issuer: 'http://fhir-server',
                    type: 'confidential-symmetric',
                    method: 'client_secret_post',
                    clientSecret: 'test-secret',
                },
            ],
        },
        { storage },
    )

    const tokenResponseNock = await mockTokenExchange({
        client_id: 'test-client',
        code: 'køde',
        code_verifier: 'test-code-verifier',
        redirect_uri: 'http://app/callback',
        client_secret: 'test-secret',
    })
    const callback = await client.callback({
        state: 'some-value',
        code: 'køde',
    })

    expect(tokenResponseNock.isDone()).toBe(true)
    expectHas(callback, 'redirectUrl')
    expect(callback.redirectUrl).toBe('http://app/redirect')
})
