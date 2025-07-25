import { teamLogger } from '@navikt/pino-logger/team-log'
import { randomPKCECodeVerifier, randomState } from 'openid-client'

import { logger } from '../logger'
import { failSpan, OtelTaxonomy, spanAsync } from '../otel'
import type { SafeSmartStorage, SmartStorage } from '../storage'
import { safeSmartStorage } from '../storage'
import type { CompleteSession, InitialSession } from '../storage/schema'
import type { CompleteSessionErrors, InitialSessionErrors } from '../storage/storage-errors'
import { assertGoodSessionId, assertNotBrowser, removeTrailingSlash } from '../utils'

import { buildAuthUrl } from './authorization'
import type { FhirAuthMode, KnownFhirServer } from './client-auth/config'
import type { CallbackError, SmartClientReadyErrors } from './client-errors'
import type { SmartClientConfiguration, SmartClientOptions } from './config'
import { ReadyClient } from './ReadyClient'
import { exchangeToken, refreshToken, tokenExpiresIn } from './token/token'
import type { RefreshTokenErrors } from './token/token-errors'
import { fetchSmartConfiguration } from './well-known/smart-configuration'
import type { SmartConfigurationErrors } from './well-known/smart-configuration-errors'

/**
 * The smart client is used to handle the launch of the Smart on FHIR application. It requires at the very least:
 * - A asyncronous storage implementation that implements the `SmartStorage` interface, for example Valkey.
 * - A FHIR server to launch towards, where the application is registered.
 *
 * Note: It's the responsibility of the application using this library to limit which issuers are allowed to be launched.
 *       This may part of this applications configuration in the future.
 */
export class SmartClient {
    /**
     * Every smart client _must_ be initialized with a unique sessionId. This is used to store the session
     * information in the storage implementation. If this is not cryptographically random and unique, there
     * will be issues with multiple users accessing the same storage and authentication flow.
     */
    readonly sessionId: string

    private readonly _storage: SafeSmartStorage
    private readonly _config: SmartClientConfiguration
    private readonly _options: SmartClientOptions

    constructor(
        sessionId: string | null | undefined,
        storage: SmartStorage | Promise<SmartStorage>,
        config: SmartClientConfiguration,
        options?: SmartClientOptions,
    ) {
        assertNotBrowser()
        assertGoodSessionId(sessionId)

        this.sessionId = sessionId

        this._storage = safeSmartStorage(storage)
        this._config = config
        this._options = options ?? { autoRefresh: false }
    }

    public get options(): { autoRefresh: boolean } {
        return {
            autoRefresh: false,
            ...this._options,
        }
    }

    /**
     * **Smart App Launch reference**
     * - EHR Launch: https://build.fhir.org/ig/HL7/smart-app-launch/app-launch.html#launch-app-ehr-launch
     * - Auth URL:   https://build.fhir.org/ig/HL7/smart-app-launch/app-launch.html#obtain-authorization-code
     *
     * The EHR-system provides the issuer URL and the launch context to the application. Initiates a partial session
     * in the session storage.
     *
     * An authorization URL is created using the OAuth 2.0 state parameter and PKCE (Proof Key for Code Exchange).
     *
     * Callee is responsible for redirecting the user to the returned `redirect_url`.
     */
    async launch(params: { iss: string; launch: string }): Promise<Launch | SmartConfigurationErrors> {
        return spanAsync('launch', async (span) => {
            span.setAttribute(OtelTaxonomy.FhirServer, removeTrailingSlash(params.iss))

            const validIssuer = await this.validateIssuer(params.iss)
            if (!validIssuer) {
                failSpan(span, new Error('Issuer was not found in known FHIR servers'))
                return { error: 'UNKNOWN_ISSUER' }
            }

            const smartConfig = await fetchSmartConfiguration(params.iss)
            if ('error' in smartConfig) {
                return { error: smartConfig.error }
            }

            /**
             * PKCE STEP 1
             * Create a cryptographically-random code_verifier
             */
            const codeVerifier = randomPKCECodeVerifier()
            const state = randomState()
            const initialSessionPayload: InitialSession = {
                server: removeTrailingSlash(params.iss),
                issuer: smartConfig.issuer,
                authorizationEndpoint: smartConfig.authorization_endpoint,
                tokenEndpoint: smartConfig.token_endpoint,
                codeVerifier: codeVerifier,
                state: state,
            }

            await this._storage.set(this.sessionId, initialSessionPayload)

            const authUrl = await buildAuthUrl(
                {
                    ...initialSessionPayload,
                    launch: params.launch,
                },
                this._config,
            )

            // TODO: Debug logging
            if (process.env.NEXT_PUBLIC_RUNTIME_ENV === 'dev-gcp') {
                teamLogger.info(`Authorization URL for launch for ${params.iss}: ${authUrl}`)
            }

            /**
             * PKCE STEP 3
             * Redirect the user to the /authorize endpoint along with the code_challenge
             *
             */
            return { redirect_url: authUrl }
        })
    }

    /**
     * **Smart App Launch reference**
     *  - Callback:       https://build.fhir.org/ig/HL7/smart-app-launch/app-launch.html#response-4
     *  - Token exchange: https://build.fhir.org/ig/HL7/smart-app-launch/app-launch.html#obtain-access-token
     *
     *  The callback is called after the user has been redirected back to the application with code and state.
     *
     *  Completes the partial session created in the `launch` method by exchanging the code for tokens.
     */
    async callback(params: { code: string; state: string }): Promise<Callback | CallbackError> {
        return spanAsync('callback', async (span) => {
            const initialSession = await this.getInitialSession(this.sessionId)
            if ('error' in initialSession) return initialSession

            span.setAttribute(OtelTaxonomy.FhirServer, initialSession.server)

            if (initialSession.state !== params.state) {
                span.setAttribute(OtelTaxonomy.SessionError, 'STATE_MISMATCH')

                logger.warn(
                    `State mismatch, expected len: ${initialSession.state.length} but got len: ${params.state.length}`,
                )

                return { error: 'INVALID_STATE' }
            }

            logger.info(`Exchanging code for token with issuer ${initialSession.tokenEndpoint}`)

            const tokenResponse = await exchangeToken(
                params.code,
                initialSession,
                this._config,
                this.getAuthMode(initialSession.server),
            )
            if ('error' in tokenResponse) {
                return { error: tokenResponse.error }
            }

            const completeSessionValues: CompleteSession = {
                ...initialSession,
                idToken: tokenResponse.id_token,
                accessToken: tokenResponse.access_token,
                refreshToken: tokenResponse.refresh_token,
                patient: tokenResponse.patient,
                encounter: tokenResponse.encounter,
                webmedPractitioner: tokenResponse.practitioner,
            }

            await this._storage.set(this.sessionId, completeSessionValues)

            return {
                redirect_url: this._config.redirect_url,
            }
        })
    }

    /**
     * **Smart App Launch reference**
     * - Accessing the FHIR API: https://build.fhir.org/ig/HL7/smart-app-launch/app-launch.html#access-fhir-api
     *
     * Once the launch has been completed, a ReadyClient {@link ReadyClient} can be created using the
     * sessionId that was used in the `launch` and `callback` methods.
     */
    async ready(): Promise<
        | ReadyClient
        | (SmartClientReadyErrors & {
              validate: ReadyClient['validate']
          })
    > {
        return spanAsync('ready', async (span) => {
            const session = this._options.autoRefresh
                ? await this.getOrRefresh(this.sessionId)
                : await this.getCompleteSession(this.sessionId)

            if ('error' in session) return { error: session.error, validate: async () => false }

            span.setAttribute(OtelTaxonomy.FhirServer, session.server)

            try {
                return new ReadyClient(this, session)
            } catch (error) {
                logger.error(
                    new Error(
                        `Tried to .ready SmartClient, ReadyClient failed to instantiate for id "${this.sessionId}"`,
                        { cause: error },
                    ),
                )
                return { error: 'INVALID_ID_TOKEN', validate: async () => false }
            }
        })
    }

    /**
     * Explicitly refreshes the session by exchanging the refresh token for a new access token.
     *
     * This will happen automatically buring the `ready`-step if the `autoRefresh` option is set to `true`.
     */
    async refresh(session: CompleteSession): Promise<CompleteSession | RefreshTokenErrors> {
        const refreshResponse = await refreshToken(session, this._config, this.getAuthMode(session.server))
        if ('error' in refreshResponse) return refreshResponse

        const refreshedSessionValues: CompleteSession = {
            ...session,
            idToken: refreshResponse.id_token,
            accessToken: refreshResponse.access_token,
            refreshToken: refreshResponse.refresh_token,
        }

        await this._storage.set(this.sessionId, refreshedSessionValues)

        return refreshedSessionValues
    }

    private async getCompleteSession(sessionId: string): Promise<CompleteSession | CompleteSessionErrors> {
        return spanAsync('get-complete', async (span) => {
            const session = await this._storage.getComplete(sessionId)

            if ('error' in session) {
                span.setAttribute('session.error', session.error)
                logger.error(`SmartClient.getSession failed to retrieve session because session is: ${session.error}`)

                return session
            }

            return session
        })
    }

    private async getInitialSession(sessionId: string): Promise<InitialSession | InitialSessionErrors> {
        return spanAsync('get-partial', async (span) => {
            const existingSession = await this._storage.getPartial(sessionId)
            if ('error' in existingSession) {
                span.setAttribute(OtelTaxonomy.SessionError, existingSession.error)

                logger.error(new Error(`Session not found for sessionId ${sessionId}, was ${existingSession.error}`))

                return { error: existingSession.error }
            }
            return existingSession
        })
    }

    private async getOrRefresh(
        sessionId: string,
    ): Promise<CompleteSession | CompleteSessionErrors | RefreshTokenErrors> {
        return spanAsync('get-or-refresh', async (span) => {
            const session = await this.getCompleteSession(sessionId)
            if ('error' in session) return session

            // Pre-emptively refresh the token if it is about to expire within 5 minutes
            if (tokenExpiresIn(session.accessToken) < 60 * 5) {
                span.setAttribute(OtelTaxonomy.SessionExpired, true)

                const refreshResult = await this.refresh(session)
                if ('error' in refreshResult) {
                    span.setAttributes({
                        [OtelTaxonomy.SessionError]: refreshResult.error,
                        [OtelTaxonomy.SessionRefreshed]: false,
                    })
                    logger.error(`SmartClient.getSession failed to refresh session because: ${refreshResult.error}`)

                    // Return potentially expired session, let the rest of the auth flow handle the expiredness.
                    return session
                }

                await this._storage.set(sessionId, refreshResult)

                span.setAttribute(OtelTaxonomy.SessionRefreshed, true)
                return refreshResult
            }

            span.setAttributes({
                [OtelTaxonomy.SessionExpired]: false,
                [OtelTaxonomy.SessionRefreshed]: false,
            })
            return session
        })
    }

    private async validateIssuer(issuer: string): Promise<boolean> {
        if ('allowAnyIssuer' in this._config) {
            if (!this._config.allowAnyIssuer)
                throw new Error('Invariant violation: allowAnyIssuer is false, should only ever be true')

            return true
        }

        return this.getKnownFhirServer(issuer) != null
    }

    private getAuthMode(server: string): FhirAuthMode {
        return this.getKnownFhirServer(server) ?? { type: 'public' }
    }

    private getKnownFhirServer(issuer: string): KnownFhirServer | null {
        if ('allowAnyIssuer' in this._config) {
            if (!this._config.allowAnyIssuer)
                throw new Error('Invariant violation: allowAnyIssuer is false, should only ever be true')

            return null
        }

        const [withoutQuery] = issuer.split('?')
        const withoutTrailingSlash = removeTrailingSlash(withoutQuery)

        return this._config.knownFhirServers.find((it) => it.issuer.replace(/\/$/, '') === withoutTrailingSlash) ?? null
    }
}

/**
 * A successful launch will end up in a redirect_url for the user to be redirected to.
 *
 * The responsibilty to redirect the user lies with the application using the SmartClient.
 */
export type Launch = {
    redirect_url: string
}

/**
 * A successful callback will end up in a redirect_url for the user to be redirected to, this URL is configured
 * by the application using the SmartClient and is typically part of the app itself.
 */
export type Callback = {
    redirect_url: string
}
