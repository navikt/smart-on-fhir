import type * as z from 'zod'

import type { ResourceRequestErrors } from '../fhir'
import { FhirClient } from '../fhir'
import type { CacheableResource } from '../fhir/cache'
import { FhirValidatorRuntime } from '../fhir/validation/fhir-validator-runtime'
import { multi } from '../internal/lib/multi'
import { failSpan, OtelTaxonomy, type Span } from '../internal/lib/otel'
import { type FhirEncounter, type FhirPatient, type FhirPractitioner } from '../zod'

import type { SmartClient } from './launch/SmartClient'
import { tokenExpiresIn, validateToken } from './launch/token/token'
import type { IdToken } from './launch/token/token-schema'
import { smartLogger } from './smart-logger'
import { type CompleteSession, idTokenClaims } from './storage/schema'
import type { ClaimErrors } from './types/client-errors'
import type { SmartValidation } from './validator/validations'

/**
 * **Smart App Launch reference**
 * - Accessing the FHIR API: https://build.fhir.org/ig/HL7/smart-app-launch/app-launch.html#access-fhir-api
 *
 * A client that is ready to access the FHIR API after a successful Smart App Launch.
 *
 * Should _only_ be instantiated through a SmartClient.
 *
 * Everything is strongly typed and zod'd!
 */
export class ReadyClient {
    private readonly _client: SmartClient
    private readonly _session: CompleteSession
    private readonly _fhirClient: FhirClient

    readonly #idToken: IdToken

    public readonly issuerName: string

    constructor(
        client: SmartClient,
        session: CompleteSession,
        issuerName: string,
        persistValidation: () => Promise<void>,
    ) {
        this.issuerName = issuerName

        this._client = client
        this._session = session

        this._fhirClient = new FhirClient(this._session, this.fetchWithRefresh, {
            validator: {
                runtime: new FhirValidatorRuntime(this._client.validator.validations),
                persist: persistValidation,
            },
            cache: client.options.cache,
        })

        this.#idToken = idTokenClaims(this._session)
    }

    public readonly request: FhirClient['request'] = (...args) => this._fhirClient.request(...args)

    public readonly create: FhirClient['create'] = (...args) => this._fhirClient.create(...args)

    public readonly update: FhirClient['update'] = (...args) => this._fhirClient.update(...args)

    public readonly batch: FhirClient['batch'] = (...args) => this._fhirClient.batch(...args)

    public get patient(): ValueAccessor<FhirPatient, 'Patient'> {
        return {
            type: 'Patient',
            reference: `Patient/${this._session.patient}`,
            id: this._session.patient,
            request: (config) => this.request(`Patient/${this._session.patient}`, config),
        }
    }

    public get encounter(): ValueAccessor<FhirEncounter, 'Encounter'> {
        return {
            type: 'Encounter',
            reference: `Encounter/${this._session.encounter}`,
            id: this._session.encounter,
            request: (config) => this.request(`Encounter/${this._session.encounter}`, config),
        }
    }

    public get user(): {
        type: 'Practitioner'
        id: string
        fhirUser: `Practitioner/${string}`
        request: (config?: CacheableResource) => Promise<FhirPractitioner | ResourceRequestErrors>
    } {
        const fhirUser = this.#idToken.fhirUser

        return {
            type: 'Practitioner',
            id: fhirUser.split('/')[1],
            get fhirUser(): `Practitioner/${string}` {
                return fhirUser as `Practitioner/${string}`
            },
            request: (config) => this.request(this.user.fhirUser, config),
        }
    }

    public async validate(): Promise<boolean> {
        const validationResult = await validateToken(this._session)

        return validationResult.valid
    }

    public getClaim(claim: string): ClaimErrors | string | Record<string, unknown>
    public getClaim<ExpectedClaimSchema extends z.ZodType>(
        claim: string,
        schema: ExpectedClaimSchema,
    ): z.infer<ExpectedClaimSchema> | ClaimErrors
    public getClaim<ExpectedClaimSchema extends z.ZodType>(
        claim: string,
        schema?: ExpectedClaimSchema,
    ): z.infer<ExpectedClaimSchema> | ClaimErrors | string | Record<string, unknown> {
        const claimValue = this.#idToken[claim] as string | Record<string, unknown> | undefined
        if (claimValue == null) {
            return { error: 'CLAIM_NOT_FOUND' }
        }

        try {
            return schema ? schema.parse(claimValue) : claimValue
        } catch (e) {
            smartLogger.error(new Error(`Claim validation failed for claim ${claim}`, { cause: e }))
            return { error: 'CLAIM_INVALID' }
        }
    }

    public getValidationReport(): SmartValidation[] {
        return this._client.validator.report()
    }

    public multi = multi

    private fetchWithRefresh = async (fetcher: () => Promise<Response>, span: Span): Promise<Response> => {
        const response = await fetcher()
        if (!this._client.options.autoRefresh) return response
        if (response.status !== 401) return response

        const expiresInSeconds = tokenExpiresIn(this._session.accessToken)
        span.setAttributes({
            [OtelTaxonomy.SessionTokenExpiresInSeconds]: expiresInSeconds,
            [OtelTaxonomy.SessionTokenAlreadyExpired]: expiresInSeconds <= 0,
        })

        const refresh = await this._client.refresh(this._session)
        if ('error' in refresh) {
            failSpan(span, `Failed to refresh session: ${refresh.error}`)

            span.setAttributes({
                [OtelTaxonomy.SessionError]: refresh.error,
                [OtelTaxonomy.SessionRefreshed]: false,
            })

            // Couldn't refresh, let the rest of the code handle the 401
            return response
        }

        // We refreshed! Let's try the resource again
        span.setAttribute(OtelTaxonomy.SessionRefreshed, true)
        return fetcher()
    }
}

export type ValueAccessor<Resource, Type extends string = never> = {
    id: string
    type: Type
    request: (config?: CacheableResource) => Promise<Resource | ResourceRequestErrors>
    reference: `${Type}/${string}`
}
