import { calculatePKCECodeChallenge, randomPKCECodeVerifier, randomState } from 'openid-client'

import type { CacheOptions } from '../cache'
import type { SafeSmartStorage, SmartStorage } from '../storage'
import { safeSmartStorage } from '../storage'
import type { CompleteSession, InitialSession } from '../storage/schema'
import type { CompleteSessionErrors, InitialSessionErrors } from '../storage/storage-errors'

import type { FhirAuthMode, KnownFhirServer } from './client-auth-method/config'
import { failSpan, OtelTaxonomy, spanAsync } from './lib/otel'
import { assertGoodSessionId, assertNotBrowser, removeTrailingSlash } from './lib/utils'
import { ReadyClient } from './ReadyClient'
import { exchangeToken, refreshToken, tokenExpiresIn } from './token/token'
import type { RefreshTokenErrors } from './token/token-errors'
import type { CallbackError, SmartClientReadyErrors } from './types/client-errors'
import type { SmartClientConfiguration, SmartClientOptions } from './types/config'
import { fetchSmartConfiguration } from './well-known/smart-configuration'
import type { SmartConfigurationErrors } from './well-known/smart-configuration-errors'

/**
 * The smart client is used to handle the launch of the Smart on FHIR application. It requires at the very least:
 * - A asynchronous storage implementation that implements the `SmartStorage` interface, for example Valkey.
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

    /**
     * When using the SmartClient in "multi-patient"-mode, i.e. allowing multiple launches, the consumer of the
     * SmartClient will keep track of the active patient (using for example sessionStorage).
     */
    readonly activePatient: string | null

    /**
     * Configuration for this instance, based on options passed to the constructor + defaults.
     */
    readonly options: {
        autoRefresh: boolean
        multiLaunch: boolean
        cache: CacheOptions
    }

    private readonly _storage: SafeSmartStorage
    private readonly _clientConfig: SmartClientConfiguration

    /**
     * Single launch mode. Any subsequent launches using the same sessionId will overwrite the previous
     * session completely. If the EHR-system supports multiple tabs that use non-isolated browser sessions
     * this could be an issue.
     */
    constructor(
        sessionId: string | null | undefined,
        clientConfiguration: SmartClientConfiguration,
        configuration: {
            cache?: CacheOptions
            storage: SmartStorage | Promise<SmartStorage>
            options?: SmartClientOptions
        },
    )
    /**
     * Multi-launch mode. Subsequent launches are stored both by sessionId and the launched patient. This allows
     * you to use have several launched apps active at the same time in multiple tabs, but requires the application
     * to keep track of the launched patient's ID and pass it back during ReadyClient-instantiation, using for example
     * sessionStorage (tab-scoped) in the browser.
     */
    constructor(
        session: { sessionId: string | null | undefined; activePatient: string | null | undefined },
        clientConfiguration: SmartClientConfiguration,
        configuration: {
            cache?: CacheOptions
            storage: SmartStorage | Promise<SmartStorage>
            options?: SmartClientOptions & {
                /**
                 * When enabled, will redirect to redirectUrl with the patient ID as a query parameter, allowing the
                 * client to store this ID at their own leisure, and using it for subsequent requests, enabling multiple
                 * simultaneous launched sessions with different patients.
                 */
                enableMultiLaunch?: true
            }
        },
    )
    constructor(
        sessionIdOrSession:
            | string
            | null
            | undefined
            | { sessionId: string | null | undefined; activePatient: string | null | undefined },
        clientConfiguration: SmartClientConfiguration,
        configuration: {
            cache?: CacheOptions
            storage: SmartStorage | Promise<SmartStorage>
            options?: SmartClientOptions & { enableMultiLaunch?: true }
        },
    ) {
        assertNotBrowser()

        const sessionId: string | null | undefined =
            typeof sessionIdOrSession === 'object' && sessionIdOrSession != null
                ? sessionIdOrSession.sessionId
                : sessionIdOrSession

        assertGoodSessionId(sessionId)

        const activePatient: string | null | undefined =
            typeof sessionIdOrSession === 'object' && sessionIdOrSession != null
                ? sessionIdOrSession.activePatient
                : null

        this.sessionId = sessionId
        this.activePatient = activePatient ?? null

        this._storage = safeSmartStorage(configuration.storage)
        this._clientConfig = clientConfiguration

        this.options = {
            autoRefresh: configuration.options?.autoRefresh ?? false,
            multiLaunch: configuration.options?.enableMultiLaunch ?? false,
            cache: configuration.cache ?? 'disabled',
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
            span.setAttributes({
                [OtelTaxonomy.FhirServer]: removeTrailingSlash(params.iss),
                [OtelTaxonomy.SessionMulti]: this.options.multiLaunch,
            })

            const validIssuer = await this.validateIssuer(params.iss)
            if (!validIssuer) {
                failSpan(span, 'Issuer was not found in known FHIR servers')
                return { error: 'UNKNOWN_ISSUER' }
            }

            const smartConfig = await fetchSmartConfiguration(params.iss)
            if ('error' in smartConfig) {
                return { error: smartConfig.error }
            }

            /**
             * PKCE STEP 1
             *
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

            /**
             * PKCE STEP 2
             * Generate a code_challenge from the code_verifier in step 1
             */
            const codeChallenge = await calculatePKCECodeChallenge(initialSessionPayload.codeVerifier)
            const authUrl = this.buildAuthorizationUrl({
                ...initialSessionPayload,
                launch: params.launch,
                codeChallenge: codeChallenge,
            })

            /**
             * PKCE STEP 3
             * Redirect the user to the /authorize endpoint along with the code_challenge
             *
             */
            return { redirectUrl: authUrl }
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

            span.setAttributes({
                [OtelTaxonomy.FhirServer]: initialSession.server,
                [OtelTaxonomy.SessionMulti]: this.options.multiLaunch,
            })

            if (initialSession.state !== params.state) {
                span.setAttribute(OtelTaxonomy.SessionError, 'STATE_MISMATCH')

                failSpan(
                    span,
                    `State mismatch, expected len: ${initialSession.state.length} but got len: ${params.state.length}`,
                )

                return { error: 'INVALID_STATE' }
            }

            const tokenResponse = await exchangeToken(
                params.code,
                initialSession,
                this._clientConfig,
                this.getAuthMode(
                    /*
                        TODO: Is it correct using session.server here? Aren't the knownFhirServer configurations
                        based on issuer?

                        We'll see once we go live with multiple FHIR servers.
                     */
                    initialSession.server,
                ),
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
            }

            await this._storage.set(this.sessionId, completeSessionValues)

            if (!this.options.multiLaunch) {
                return { redirectUrl: this._clientConfig.redirectUrl }
            }

            /**
             * When multi-launch is enabled, we also store the session under <sessionId>:<patientId> to allow
             * for the state to be retrieved in a activePatient-context later.
             */
            await this._storage.set(`${this.sessionId}:${tokenResponse.patient}`, completeSessionValues)

            const url = new URL(this._clientConfig.redirectUrl)
            url.searchParams.set('patient', completeSessionValues.patient)
            return { redirectUrl: url.toString() }
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
            const session = this.options.autoRefresh ? await this.getOrRefresh() : await this.getCompleteSession()

            if ('error' in session) return { error: session.error, validate: async () => false }

            span.setAttributes({
                [OtelTaxonomy.FhirServer]: session.server,
                [OtelTaxonomy.SessionMulti]: this.options.multiLaunch,
            })

            const currentIssuer = this.getKnownFhirServer(session.server)

            try {
                return new ReadyClient(this, session, currentIssuer?.name ?? 'open issuer')
            } catch (error) {
                failSpan(
                    span,
                    `ReadyClient instantiation failed (INVALID_ID_TOKEN) failed to instantiate for id "${this.sessionId}"`,
                    error,
                )

                return { error: 'INVALID_ID_TOKEN', validate: async () => false }
            }
        })
    }

    /**
     * Explicitly refreshes the session by exchanging the refresh token for a new access token.
     *
     * This will happen automatically during the `ready`-step if the `autoRefresh` option is set to `true`.
     */
    async refresh(session: CompleteSession): Promise<CompleteSession | RefreshTokenErrors> {
        const refreshResponse = await refreshToken(session, this._clientConfig, this.getAuthMode(session.server))
        if ('error' in refreshResponse) return refreshResponse

        const refreshedSessionValues: CompleteSession = {
            ...session,
            accessToken: refreshResponse.access_token,
            refreshToken: refreshResponse.refresh_token,
        }

        await this._storage.set(this.sessionId, refreshedSessionValues)
        if (this.activePatient) {
            await this._storage.set(`${this.sessionId}:${this.activePatient}`, refreshedSessionValues)
        }

        return refreshedSessionValues
    }

    private async getCompleteSession(): Promise<CompleteSession | CompleteSessionErrors> {
        return spanAsync('get-complete', async (span) => {
            let session: CompleteSession | CompleteSessionErrors
            if (this.activePatient != null) {
                const activePatientSession = await this._storage.getComplete(`${this.sessionId}:${this.activePatient}`)

                if ('error' in activePatientSession) {
                    session = await this._storage.getComplete(this.sessionId)
                } else {
                    session = activePatientSession
                }
            } else {
                session = await this._storage.getComplete(this.sessionId)
            }

            if ('error' in session) {
                span.setAttribute('session.error', session.error)
                failSpan(span, `SmartClient.getSession failed to retrieve session because session is ${session.error}`)

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
                failSpan(span, `Session not found for sessionId ${sessionId}, was ${existingSession.error}`)

                return { error: existingSession.error }
            }
            return existingSession
        })
    }

    private async getOrRefresh(): Promise<CompleteSession | CompleteSessionErrors | RefreshTokenErrors> {
        return spanAsync('get-or-refresh', async (span) => {
            const session = await this.getCompleteSession()
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

                    failSpan(span, 'SmartClient.getSession failed to refresh session', refreshResult.error)

                    // Return potentially expired session, let the rest of the auth flow handle the expiredness.
                    return session
                }

                await this._storage.set(this.sessionId, refreshResult)
                if (this.activePatient) {
                    await this._storage.set(`${this.sessionId}:${this.activePatient}`, refreshResult)
                }

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
        if ('allowAnyIssuer' in this._clientConfig) {
            if (!this._clientConfig.allowAnyIssuer)
                throw new Error('Invariant violation: allowAnyIssuer is false, should only ever be true')

            return true
        }

        return this.getKnownFhirServer(issuer) != null
    }

    private getAuthMode(server: string): FhirAuthMode {
        return this.getKnownFhirServer(server) ?? { type: 'public' }
    }

    private getKnownFhirServer(issuer: string): KnownFhirServer | null {
        if ('allowAnyIssuer' in this._clientConfig) {
            if (!this._clientConfig.allowAnyIssuer) {
                throw Error('Invariant violation: allowAnyIssuer is false, should only ever be true')
            }

            return null
        }

        const [withoutQuery] = issuer.split('?')
        const withoutTrailingSlash = removeTrailingSlash(withoutQuery)
        const knownFhirServer = this._clientConfig.knownFhirServers.find(
            (it) => it.issuer.replace(/\/$/, '') === withoutTrailingSlash,
        )

        return knownFhirServer ?? null
    }

    private buildAuthorizationUrl(
        opts: Pick<InitialSession, 'issuer' | 'state' | 'authorizationEndpoint'> & {
            launch: string
            codeChallenge: string
        },
    ): string {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this._clientConfig.clientId,
            scope: this._clientConfig.scope,
            redirect_uri: this._clientConfig.callbackUrl,
            aud: opts.issuer,
            launch: opts.launch,
            state: opts.state,
            code_challenge: opts.codeChallenge,
            code_challenge_method: 'S256',
        })
        return `${opts.authorizationEndpoint}?${params.toString()}`
    }
}

/**
 * A successful launch will end up in a redirectUrl for the user to be redirected to.
 *
 * The responsibility to redirect the user lies with the application using the SmartClient.
 */
export type Launch = {
    redirectUrl: string
}

/**
 * A successful callback will end up in a redirectUrl for the user to be redirected to, this URL is configured
 * by the application using the SmartClient and is typically part of the app itself.
 */
export type Callback = {
    redirectUrl: string
}
