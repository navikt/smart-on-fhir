import { decodeJwt, jwtVerify } from 'jose'
import type * as z from 'zod'

import type { FhirEncounter, FhirPatient, FhirPractitioner } from '../../zod'
import { logger } from '../lib/logger'
import { failSpan, OtelTaxonomy, type Span, spanAsync, squelchTracing } from '../lib/otel'
import { getResponseError, inferResourceType } from '../lib/utils'
import type { CompleteSession } from '../storage/schema'

import {
    createResourceToSchema,
    type KnownCreatePaths,
    type PayloadForCreate,
    type ResponseForCreate,
} from './resources/create-resource-map'
import { getFhir, postFhir, putFhir } from './resources/fetcher'
import { type KnownPaths, type ResponseFor, resourceToSchema } from './resources/resource-map'
import type { SmartClient } from './SmartClient'
import { type IdToken, IdTokenSchema } from './token/token-schema'
import type { ClaimErrors, ResourceCreateErrors, ResourceRequestErrors } from './types/client-errors'
import { fetchSmartConfiguration, getJwkSet } from './well-known/smart-configuration'

/**
 * **Smart App Launch reference**
 * - Accessing the FHIR API: https://build.fhir.org/ig/HL7/smart-app-launch/app-launch.html#access-fhir-api
 *
 * A client that is ready to access the FHIR API after a successful Smart App Launch.
 *
 * Everything is strongly typed and zod'd!
 */
export class ReadyClient {
    private readonly _client: SmartClient
    private readonly _session: CompleteSession
    private readonly _idToken: IdToken

    constructor(client: SmartClient, session: CompleteSession) {
        this._client = client
        this._session = session
        this._idToken = IdTokenSchema.loose().parse(decodeJwt(session.idToken))
    }

    public get patient(): ValueAccessor<FhirPatient, 'Patient'> {
        return {
            type: 'Patient',
            reference: `Patient/${this._session.patient}`,
            id: this._session.patient,
            request: () => this.request(`Patient/${this._session.patient}`),
        }
    }

    public get encounter(): ValueAccessor<FhirEncounter, 'Encounter'> {
        return {
            type: 'Encounter',
            reference: `Encounter/${this._session.encounter}`,
            id: this._session.encounter,
            request: () => this.request(`Encounter/${this._session.encounter}`),
        }
    }

    public get user(): {
        type: 'Practitioner'
        id: string
        fhirUser: `Practitioner/${string}`
        request: () => Promise<FhirPractitioner | ResourceRequestErrors>
    } {
        const idToken = this._idToken

        return {
            type: 'Practitioner',
            id: idToken.fhirUser.split('/')[1],
            get fhirUser(): `Practitioner/${string}` {
                return idToken.fhirUser as `Practitioner/${string}`
            },
            request: () => this.request(this.user.fhirUser),
        }
    }

    public async validate(): Promise<boolean> {
        return spanAsync('validate', async (span) => {
            span.setAttribute(OtelTaxonomy.FhirServer, this._session.server)

            const smartConfig = await fetchSmartConfiguration(this._session.server)
            if ('error' in smartConfig) {
                logger.error(`Failed to fetch smart configuration: ${smartConfig.error}`)
                return false
            }

            try {
                return await spanAsync('jwt-verify', async (span) => {
                    span.setAttribute(OtelTaxonomy.FhirServer, this._session.server)

                    await jwtVerify(this._session.accessToken, getJwkSet(smartConfig.jwks_uri), {
                        issuer: this._session.issuer,
                        algorithms: ['RS256'],
                    })

                    return true
                })
            } catch (e) {
                failSpan(span, new Error(`Token validation failed, ${(e as { code: string })?.code ?? 'UNKNOWN'}`))
                return false
            }
        })
    }

    public async create<Path extends KnownCreatePaths>(
        resource: Path,
        params: { payload: PayloadForCreate<Path> },
    ): Promise<ResponseForCreate<Path> | ResourceCreateErrors> {
        const resourceType = inferResourceType(resource)

        return spanAsync(`create.${resourceType}`, async (span) => {
            span.setAttributes({
                [OtelTaxonomy.FhirResource]: resourceType,
                [OtelTaxonomy.FhirServer]: this._session.server,
            })

            const response = await this.fetchWithRefresh(
                () => postFhir({ session: this._session, path: resource }, { payload: params.payload }),
                span,
            )

            if (!response.ok) {
                const responseError = await getResponseError(response)

                span.setAttribute(OtelTaxonomy.FhirResourceStatus, 'creation-failed')
                failSpan(
                    span,
                    new Error(
                        `Request to create ${resourceType} failed, ${response.url} responded with ${response.status} ${response.statusText}, server says: ${responseError}`,
                    ),
                )

                return { error: 'CREATE_FAILED_NON_OK_RESPONSE' }
            }

            const result = await response.json()
            const parsed = createResourceToSchema(resource).safeParse(result)
            if (!parsed.success) {
                span.setAttribute(OtelTaxonomy.FhirResourceStatus, 'parsing-failed')
                failSpan(span, new Error('Failed to parse DocumentReference', { cause: parsed.error }))

                return { error: 'CREATE_FAILED_INVALID_RESPONSE' }
            }

            span.setAttribute(OtelTaxonomy.FhirResourceStatus, 'creation-succeeded')

            return parsed.data as ResponseForCreate<Path>
        })
    }

    public async update<Path extends KnownCreatePaths>(
        resource: Path,
        params: { id: string; payload: PayloadForCreate<Path> },
    ): Promise<ResponseForCreate<Path> | ResourceCreateErrors> {
        const resourceType = inferResourceType(resource)

        return spanAsync(`update.${resourceType}`, async (span) => {
            span.setAttributes({
                [OtelTaxonomy.FhirResource]: resourceType,
                [OtelTaxonomy.FhirServer]: this._session.server,
            })

            const response = await this.fetchWithRefresh(
                () => putFhir({ id: params.id, session: this._session, path: resource }, { payload: params.payload }),
                span,
            )

            if (!response.ok) {
                const responseError = await getResponseError(response)

                span.setAttribute(OtelTaxonomy.FhirResourceStatus, 'update-failed')
                failSpan(
                    span,
                    new Error(
                        `Request to update (PUT) ${resourceType} failed, ${response.url} responded with ${response.status} ${response.statusText}, server says: ${responseError}`,
                    ),
                )

                return { error: 'CREATE_FAILED_NON_OK_RESPONSE' }
            }

            const result = await response.json()
            const parsed = createResourceToSchema(resource).safeParse(result)
            if (!parsed.success) {
                span.setAttribute(OtelTaxonomy.FhirResourceStatus, 'parsing-failed')
                failSpan(
                    span,
                    new Error('Failed to parse DocumentReference (from PUT/update)', { cause: parsed.error }),
                )

                return { error: 'CREATE_FAILED_INVALID_RESPONSE' }
            }

            span.setAttribute(OtelTaxonomy.FhirResourceStatus, 'update-succeeded')

            return parsed.data as ResponseForCreate<Path>
        })
    }

    public async request<Path extends KnownPaths>(
        resource: Path,
        /**
         * If set to true, will not mark the OTEL span as failed if the resource is not found.
         */
        otelSpanConfig?: { expectNotFound: true },
    ): Promise<ResponseFor<Path> | ResourceRequestErrors> {
        const resourceType = inferResourceType(resource)

        return spanAsync(`request.${resourceType}`, async (span) => {
            span.setAttributes({
                [OtelTaxonomy.FhirResource]: resourceType,
                [OtelTaxonomy.FhirServer]: this._session.server,
            })

            const doRequest = () => getFhir({ session: this._session, path: resource })
            const response = await this.fetchWithRefresh(
                () => (otelSpanConfig?.expectNotFound ? squelchTracing(doRequest) : doRequest()),
                span,
            )

            if (response.status === 404) {
                span.setAttribute(OtelTaxonomy.FhirResourceStatus, 'not-found')
                if (!otelSpanConfig?.expectNotFound) {
                    logger.warn(`Resource (${resource}) was not found on FHIR server`)
                }
                return { error: 'REQUEST_FAILED_RESOURCE_NOT_FOUND' }
            }

            if (!response.ok) {
                const responseError = await getResponseError(response)

                span.setAttribute(OtelTaxonomy.FhirResourceStatus, 'request-failed')
                failSpan(
                    span,
                    new Error(
                        `Request to get ${resource} failed, ${response.url} responded with ${response.status} ${response.statusText}, server said: ${responseError}`,
                    ),
                )

                return { error: 'REQUEST_FAILED_NON_OK_RESPONSE' }
            }

            const result = await response.json()
            const parsed = resourceToSchema(resource).safeParse(result)
            if (!parsed.success) {
                logger.error(new Error(`Failed to parse ${resource}`, { cause: parsed.error }))
                return { error: 'REQUEST_FAILED_INVALID_RESPONSE' }
            }

            span.setAttribute(OtelTaxonomy.FhirResourceStatus, 'resource-found')

            return parsed.data as ResponseFor<Path>
        })
    }

    public getClaim(claim: string): ClaimErrors | unknown
    public getClaim<ExpectedClaimSchema extends z.ZodType>(
        claim: string,
        schema: ExpectedClaimSchema,
    ): z.infer<ExpectedClaimSchema> | ClaimErrors
    public getClaim<ExpectedClaimSchema extends z.ZodType>(
        claim: string,
        schema?: ExpectedClaimSchema,
    ): z.infer<ExpectedClaimSchema> | ClaimErrors | unknown {
        const claimValue = this._idToken[claim]
        if (claimValue == null) {
            return { error: 'CLAIM_NOT_FOUND' }
        }

        try {
            return schema ? schema.parse(claimValue) : claimValue
        } catch (e) {
            logger.error(new Error(`Claim validation failed for claim ${claim}`, { cause: e }))
            return { error: 'CLAIM_INVALID' }
        }
    }

    private async fetchWithRefresh(fetcher: () => Promise<Response>, span: Span): Promise<Response> {
        const response = await fetcher()
        if (!this._client.options.autoRefresh) return response
        if (response.status !== 401) return response

        const refresh = await this._client.refresh(this._session)
        if ('error' in refresh) {
            logger.error(`Failed to refresh session: ${refresh.error}`)
            span.setAttributes({
                [OtelTaxonomy.SessionError]: refresh.error,
                [OtelTaxonomy.SessionRefreshed]: false,
            })
            // Couldn't refresh, let the rest of the code handle the 401
            return response
        }

        // We refreshed! Let's try the resource again
        return fetcher()
    }
}

type ValueAccessor<Resource, Type extends string = never> = {
    id: string
    type: Type
    request: () => Promise<Resource | ResourceRequestErrors>
    reference: `${Type}/${string}`
}
