import { teamLogger } from '@navikt/pino-logger/team-log'
import { decodeJwt } from 'jose'

import { logger } from '../../logger'
import { failSpan, OtelTaxonomy, spanAsync } from '../../otel'
import type { CompleteSession, InitialSession } from '../../storage/schema'
import { getResponseError } from '../../utils'
import type { FhirAuthMode } from '../client-auth/config'
import { postFormEncoded } from '../client-auth/fetch'
import type { SmartClientConfiguration } from '../config'

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
        span.setAttribute(OtelTaxonomy.FhirServer, session.server)

        const tokenRequestBody = {
            client_id: config.client_id,
            grant_type: 'authorization_code',
            code: code,
            code_verifier: session.codeVerifier,
            redirect_uri: config.callback_url,
        }

        // TODO: Debug logging
        if (process.env.NEXT_PUBLIC_RUNTIME_ENV === 'dev-gcp') {
            teamLogger.info(`Exchanging code for ${session.server}, body: ${JSON.stringify(tokenRequestBody)}`)
        }

        /**
         * PKCE STEP 5
         * Send code and the code_verifier (created in step 1) to the authorization servers /oauth/token endpoint.
         */
        const response = await postFormEncoded(
            session.tokenEndpoint,
            new URLSearchParams(tokenRequestBody),
            config.client_id,
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
                new Error(`Issuer/token_endpoint ${session.tokenEndpoint} responded with weird token response`, {
                    cause: parsedTokenResponse.error,
                }),
            )

            return { error: 'TOKEN_EXCHANGE_INVALID_BODY' }
        }

        // TODO: Debug logging
        if (process.env.NEXT_PUBLIC_RUNTIME_ENV === 'dev-gcp') {
            teamLogger.info(`Token exchange successfully, entire token response: ${JSON.stringify(result)}`)
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
        span.setAttribute(OtelTaxonomy.FhirServer, session.server)

        const tokenRequestBody = {
            client_id: config.client_id,
            grant_type: 'refresh_token',
            refresh_token: session.refreshToken,
        }

        if (process.env.NEXT_PUBLIC_RUNTIME_ENV === 'dev-gcp') {
            teamLogger.info(`Refreshing token for ${session.server}, body: ${JSON.stringify(tokenRequestBody)}`)
        }

        const response = await postFormEncoded(
            session.tokenEndpoint,
            new URLSearchParams(tokenRequestBody),
            config.client_id,
            authMode,
        )

        if (!response.ok) {
            const responseError = await getResponseError(response)

            failSpan(
                span,
                new Error(
                    `Token refresh failed, token_endpoint responded with ${response.status} ${response.statusText}, server says: ${responseError}`,
                ),
            )

            return { error: 'REFRESH_TOKEN_FAILED' }
        }

        const result: unknown = await response.json()
        const parsedTokenResponse = TokenRefreshResponseSchema.safeParse(result)

        if (!parsedTokenResponse.success) {
            const exception = new Error(
                `Issuer/token_endpoint ${session.tokenEndpoint} responded with weird token response`,
                {
                    cause: parsedTokenResponse.error,
                },
            )

            logger.error(exception)
            span.recordException(exception)

            return { error: 'REFRESH_TOKEN_INVALID_BODY' }
        }

        if (process.env.NEXT_PUBLIC_RUNTIME_ENV === 'dev-gcp') {
            teamLogger.info(`Token refresh successful, entire token response: ${JSON.stringify(result)}`)
        }

        return parsedTokenResponse.data
    })
}

export function tokenExpiresIn(jwtToken: string): number {
    const { exp } = decodeJwt(jwtToken)
    const now = Math.floor(Date.now() / 1000)

    return exp ? exp - now : 0
}
