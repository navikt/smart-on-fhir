import { decodeJwt } from 'jose'

import type { CompleteSession, InitialSession } from '../../storage/schema'
import type { FhirAuthMode } from '../client-auth-method/config'
import { postFormEncoded } from '../client-auth-method/fetch'
import { logger } from '../lib/logger'
import { failSpan, OtelTaxonomy, spanAsync } from '../lib/otel'
import { getResponseError } from '../lib/utils'
import type { SmartClientConfiguration } from '../types/config'

import type { RefreshTokenErrors, TokenExchangeErrors } from './token-errors'
import {
    type TokenRefreshResponse,
    TokenRefreshResponseSchema,
    type TokenResponse,
    TokenResponseSchema,
} from './token-schema'

export async function exchangeToken(
    code: string,
    session: InitialSession,
    config: SmartClientConfiguration,
    authMode: FhirAuthMode,
): Promise<TokenResponse | TokenExchangeErrors> {
    return spanAsync('token-exchange', async (span) => {
        span.setAttributes({
            [OtelTaxonomy.FhirServer]: session.server,
            [OtelTaxonomy.FhirAuthorizationType]: authMode.type,
        })

        const tokenRequestBody = {
            client_id: config.clientId,
            grant_type: 'authorization_code',
            code: code,
            code_verifier: session.codeVerifier,
            redirect_uri: config.callbackUrl,
        }

        /**
         * PKCE STEP 5
         * Send code and the code_verifier (created in step 1) to the authorization servers /oauth/token endpoint.
         */
        const response = await postFormEncoded(
            session.tokenEndpoint,
            new URLSearchParams(tokenRequestBody),
            config.clientId,
            authMode,
        )

        /**
         * PKCE STEP 6
         * Authorization server verifies the code_challenge and code_verifier.
         * Upon successful verification the authorization server issues id_token, access_token and (optional) refresh_token.
         */
        if (!response.ok) {
            const responseError = await getResponseError(response)
            logger.error(
                `Token exchange failed, token_endpoint responed with ${response.status} ${response.statusText}, server says: ${responseError}`,
            )

            span.recordException(
                new Error(
                    `Token exchange failed, token_endpoint responed with ${response.status} ${response.statusText}`,
                ),
            )

            return { error: 'TOKEN_EXCHANGE_FAILED' }
        }

        const result: unknown = await response.json()
        const parsedTokenResponse = TokenResponseSchema.safeParse(result)

        if (!parsedTokenResponse.success) {
            failSpan(
                span,
                'Invalid Issuer/token_endpoint response',
                new Error(`${session.tokenEndpoint} responded with weird token response`, {
                    cause: parsedTokenResponse.error,
                }),
            )

            return { error: 'TOKEN_EXCHANGE_INVALID_BODY' }
        }

        return parsedTokenResponse.data
    })
}

export async function refreshToken(
    session: CompleteSession,
    config: SmartClientConfiguration,
    authMode: FhirAuthMode,
): Promise<TokenRefreshResponse | RefreshTokenErrors> {
    return spanAsync('token-refresh', async (span) => {
        span.setAttributes({
            [OtelTaxonomy.FhirServer]: session.server,
            [OtelTaxonomy.FhirAuthorizationType]: authMode.type,
        })

        const tokenRequestBody = {
            client_id: config.clientId,
            grant_type: 'refresh_token',
            refresh_token: session.refreshToken,
        }

        const response = await postFormEncoded(
            session.tokenEndpoint,
            new URLSearchParams(tokenRequestBody),
            config.clientId,
            authMode,
        )

        if (!response.ok) {
            const responseError = await getResponseError(response)

            failSpan(
                span,
                'Token refresh failed',
                new Error(
                    `Token_endpoint responded with ${response.status} ${response.statusText}, server says: ${responseError}`,
                ),
            )

            return { error: 'REFRESH_TOKEN_FAILED' }
        }

        const result: unknown = await response.json()
        const parsedTokenResponse = TokenRefreshResponseSchema.safeParse(result)

        if (!parsedTokenResponse.success) {
            failSpan(
                span,
                `Issuer/token_endpoint ${session.tokenEndpoint} responded with weird token response`,
                parsedTokenResponse.error,
            )

            return { error: 'REFRESH_TOKEN_INVALID_BODY' }
        }

        return parsedTokenResponse.data
    })
}

export function tokenExpiresIn(jwtToken: string): number {
    const { exp } = decodeJwt(jwtToken)
    const now = Math.floor(Date.now() / 1000)

    return exp ? exp - now : 0
}
