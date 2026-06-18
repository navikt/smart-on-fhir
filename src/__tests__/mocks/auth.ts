import nock, { type Scope } from 'nock'

import { createTestIdToken } from '../utils/token'

import { AUTH_SERVER } from './common'

type TokenExchangeValues = {
    client_id: string
    code: string
    code_verifier: string
    redirect_uri: string
    /**
     * Used for confidential symmetric clients using client_secret_post
     */
    client_secret?: string
}

export async function mockTokenExchange(
    expectedBody: TokenExchangeValues,
    values?: Record<string, unknown>,
    authHeader?: string,
): Promise<Scope> {
    const postInterceptor = nock(AUTH_SERVER).post('/token', {
        ...expectedBody,
        grant_type: 'authorization_code',
    })

    if (authHeader) {
        postInterceptor.matchHeader('Authorization', (headerValue) => {
            if (headerValue === authHeader) return true

            console.error(
                new Error(`Expected Authorization to be "${authHeader}", but was "${headerValue ?? 'undefined'}"`),
            )
            return false
        })
    }

    return postInterceptor.reply(200, {
        access_token: 'test-access-token',
        id_token: await createTestIdToken({
            fhirUser: 'Practitioner/71503542-c4f5-4f11-a5a5-6633c139d0d4',
        }),
        refresh_token: 'test-refresh-token',
        patient: 'c4664cf0-9168-4b6f-8798-93799068552b',
        encounter: '3cdff553-e0ce-4fe0-89ca-8a3b62ca853e',
        ...values,
    })
}

type PrivateKeyJwtTokenExchangeValues = {
    client_id: string
    code: string
    code_verifier: string
    redirect_uri: string
}

/**
 * Mocks the token exchange for `private_key_jwt` clients. Because the `client_assertion`
 * is a freshly signed JWT (with non-deterministic `jti`/`iat`/`exp`), it can't be matched
 * by value. Instead we assert the deterministic fields and capture the assertion so the
 * test can verify the real signature/claims.
 */
export async function mockPrivateKeyJwtTokenExchange(
    expectedBody: PrivateKeyJwtTokenExchangeValues,
): Promise<{ scope: Scope; getClientAssertion: () => string | undefined }> {
    let clientAssertion: string | undefined

    const scope = nock(AUTH_SERVER)
        .post('/token', (body) => {
            clientAssertion = typeof body.client_assertion === 'string' ? body.client_assertion : undefined

            return (
                body.grant_type === 'authorization_code' &&
                body.client_id === expectedBody.client_id &&
                body.code === expectedBody.code &&
                body.code_verifier === expectedBody.code_verifier &&
                body.redirect_uri === expectedBody.redirect_uri &&
                body.client_assertion_type === 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer' &&
                typeof body.client_assertion === 'string'
            )
        })
        .reply(200, {
            access_token: 'test-access-token',
            id_token: await createTestIdToken({
                fhirUser: 'Practitioner/71503542-c4f5-4f11-a5a5-6633c139d0d4',
            }),
            refresh_token: 'test-refresh-token',
            patient: 'c4664cf0-9168-4b6f-8798-93799068552b',
            encounter: '3cdff553-e0ce-4fe0-89ca-8a3b62ca853e',
        })

    return { scope, getClientAssertion: () => clientAssertion }
}

type TokenRefreshValues = {
    client_id: string
    refresh_token: string
}

export async function mockTokenRefresh(expectedBody: TokenRefreshValues): Promise<Scope> {
    return nock(AUTH_SERVER)
        .post('/token', {
            ...expectedBody,
            grant_type: 'refresh_token',
        })
        .reply(200, {
            access_token: 'test-access-token',
            id_token: await createTestIdToken({
                fhirUser: 'Practitioner/71503542-c4f5-4f11-a5a5-6633c139d0d4',
            }),
            refresh_token: 'test-refresh-token',
        })
}
