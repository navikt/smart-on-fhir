import { expect, test } from 'vitest'

import { SmartClient } from '../client'

import { mockTokenExchange } from './mocks/auth'
import { fhirNock, mockSmartConfiguration } from './mocks/issuer'
import { expectHas } from './utils/expect'
import { createMockedStorage } from './utils/storage'

test('.launch - should fetch well-known and create a launch URL', async () => {
    const storage = createMockedStorage()
    const client = new SmartClient('test-session', storage, {
        clientId: 'test-client',
        scope: 'openid fhirUser launch/patient',
        callbackUrl: 'http://app/callback',
        redirectUrl: 'http://app/redirect',
        allowAnyIssuer: true,
    })

    const smartConfigNock = mockSmartConfiguration()
    const result = await client.launch({
        launch: 'test-launch',
        iss: 'http://fhir-server',
    })

    expect(smartConfigNock.isDone()).toBe(true)

    /**
     * Should store partial session in the storage
     */
    expect(storage.setFn).toHaveBeenCalledWith('test-session', {
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
    expectHas(result, 'redirect_url')
    const params = Object.fromEntries(new URL(result.redirect_url).searchParams.entries())
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
    const client = new SmartClient('test-session', storage, {
        clientId: 'test-client',
        scope: 'openid fhirUser launch/patient',
        callbackUrl: 'http://app/callback',
        redirectUrl: 'http://app/redirect',
        allowAnyIssuer: true,
    })

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
    const client = new SmartClient('test-session', storage, {
        clientId: 'test-client',
        scope: 'openid fhirUser launch/patient',
        callbackUrl: 'http://app/callback',
        redirectUrl: 'http://app/redirect',
        allowAnyIssuer: true,
    })

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

    const client = new SmartClient('test-session', storage, {
        clientId: 'test-client',
        scope: 'openid fhirUser launch/patient',
        callbackUrl: 'http://app/callback',
        redirectUrl: 'http://app/redirect',
        allowAnyIssuer: true,
    })

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
    expectHas(callback, 'redirect_url')
    expect(callback.redirect_url).toBe('http://app/redirect')
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

    const client = new SmartClient('test-session', storage, {
        clientId: 'test-client',
        scope: 'openid fhirUser launch/patient',
        callbackUrl: 'http://app/callback',
        redirectUrl: 'http://app/redirect',
        allowAnyIssuer: true,
    })

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
