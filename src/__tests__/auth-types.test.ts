import { expect, test } from 'vitest'

import { SmartClient } from '../client'

import { mockTokenExchange } from './mocks/auth'
import { mockSmartConfiguration } from './mocks/issuer'
import { expectHas } from './utils/expect'
import { createMockedStorage } from './utils/storage'

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
