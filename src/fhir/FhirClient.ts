import type { Span } from '@opentelemetry/api'

import { multi } from '#internal-lib/multi'
import { createTracing, failSpan, squelchTracing } from '#internal-lib/otel'
import { inferResourceType } from '#internal-lib/utils'
import { type FhirBatchBundle, type FhirBatchResponseBundle, FhirBatchResponseBundleSchema } from '#zod'

import { type CacheableResource, type CacheOptions, getCachedResource, setCachedResource } from './cache'
import { assertErrorRecorderEnabled, type ErrorRecorder } from './error-recorder/ErrorRecorder'
import { fhirResponseToFormattedError } from './fhir-errors'
import {
    bundleFhir,
    getFhir,
    postFhir,
    putFhir,
    type PutFhirResourceIdentifier,
    type PutPostFhirPayload,
} from './fhir-fetch'
import { fhirLogger } from './fhir-logger'
import { FhirOtelAttributes } from './fhir-otel'
import type { ResourceBatchErrors, ResourceCreateErrors, ResourceRequestErrors } from './fhir-resource-errors'
import type { AuthenticatedServer, OpenServer } from './fhir-servers'
import {
    createResourceToSchema,
    type KnownCreatePaths,
    type PayloadForCreate,
    type ResponseForCreate,
} from './resources/create-resource-map'
import { type KnownPaths, resourceToSchema, type ResponseFor } from './resources/request-resource-map'
import type { FhirValidatorRuntime } from './validation/fhir-validator-runtime'

const { spanAsync } = createTracing('fhir')

/**
 * A client configured with one FHIR server with optional authentication for non-open clients.
 *
 * Also supports different confidential client authentication methods.
 */
export class FhirClient {
    readonly #server: AuthenticatedServer | OpenServer
    readonly #fetcher: (request: () => Promise<Response>, span: Span) => Promise<Response>
    readonly #cache: CacheOptions

    readonly #errorRecorder?: ErrorRecorder
    readonly #validator?: FhirValidatorRuntime
    readonly #persistValidation?: () => Promise<void>

    constructor(
        server: AuthenticatedServer | OpenServer,
        options?: {
            /**
             * Enable to opt-in to error recovery. If enabled, any failed requests will be recorded in the provided ErrorRecorder.
             */
            errorRecorder?: ErrorRecorder
            /**
             * Optional fetcher, used if you for example want to refresh tokens and retry.
             */
            fetcher?: (request: () => Promise<Response>, span: Span) => Promise<Response>
            /**
             * The validator runtime to use for validating FHIR resources.
             */
            validator?: {
                runtime: FhirValidatorRuntime
                persist?: () => Promise<void>
            }
            /**
             * If set, will cache FHIR resources in the provided cache. If not set, caching is disabled.
             */
            cache?: CacheOptions
        },
    ) {
        this.#server = server
        this.#validator = options?.validator?.runtime
        this.#persistValidation = options?.validator?.persist
        this.#cache = options?.cache ?? 'disabled'
        this.#errorRecorder = options?.errorRecorder

        this.#fetcher = options?.fetcher ?? ((request) => request())
    }

    public async create<Path extends KnownCreatePaths>(
        resource: Path,
        params: {
            payload: PayloadForCreate<Path>
            /**
             * When true, will record any errors in the provided ErrorRecorder
             */
            recoverable?: boolean
        },
    ): Promise<ResponseForCreate<Path> | ResourceCreateErrors> {
        const resourceType = inferResourceType(resource)

        return spanAsync(`create.${resourceType}`, async (span) => {
            span.setAttributes({
                [FhirOtelAttributes.FhirResource]: resourceType,
                [FhirOtelAttributes.FhirServer]: this.#server.fhirServer,
            })

            const postPayload: PutPostFhirPayload = { payload: params.payload }
            const response = await this.#fetcher(() => postFhir(this.#server, resource, postPayload), span)

            if (!response.ok) {
                const [responseError, operationOutcome] = await fhirResponseToFormattedError(response)

                span.setAttribute(FhirOtelAttributes.FhirResourceStatus, 'creation-failed')
                failSpan(span, `Request to create ${resourceType} failed`, responseError)

                if (params.recoverable) {
                    assertErrorRecorderEnabled(this.#errorRecorder)
                    await this.#errorRecorder.add({
                        method: 'POST',
                        path: resource,
                        payload: postPayload,
                        error: operationOutcome ?? responseError,
                    })
                }

                switch (response.status) {
                    case 501: // not implemented, should never hit
                        fhirLogger.error(
                            `Server responded 501 to create ${resourceType}. This EHR (${this.#server.fhirServer}) is seriously misconfigured, contact the issuer.`,
                        )
                        return { error: 'CREATE_FAILED_NOT_SUPPORTED', operationOutcome }
                    case 404: // not implemented for writes
                    case 405: // the server does not support this verb on this resource
                        return { error: 'CREATE_FAILED_NOT_SUPPORTED', operationOutcome }
                    default:
                        return { error: 'CREATE_FAILED_NON_OK_RESPONSE', operationOutcome }
                }
            }

            const result = await response.json()
            const parsed = createResourceToSchema(resource).loose().safeParse(result)
            if (!parsed.success) {
                span.setAttribute(FhirOtelAttributes.FhirResourceStatus, 'parsing-failed')
                failSpan(span, `Failed to parse ${resourceType}`, parsed.error)

                return { error: 'CREATE_FAILED_INVALID_RESPONSE' }
            }

            void this.registerResourceValidation(parsed.data as ResponseForCreate<Path>)

            span.setAttribute(FhirOtelAttributes.FhirResourceStatus, 'creation-succeeded')

            return parsed.data as ResponseForCreate<Path>
        })
    }

    public async update<Path extends KnownCreatePaths>(
        resource: Path,
        params: {
            id: string
            payload: PayloadForCreate<Path>
            /**
             * When true, will record any errors in the provided ErrorRecorder
             */
            recoverable?: boolean
        },
    ): Promise<ResponseForCreate<Path> | ResourceCreateErrors> {
        const resourceType = inferResourceType(resource)

        return spanAsync(`update.${resourceType}`, async (span) => {
            span.setAttributes({
                [FhirOtelAttributes.FhirResource]: resourceType,
                [FhirOtelAttributes.FhirServer]: this.#server.fhirServer,
            })

            const resourceIdentifier: PutFhirResourceIdentifier = { id: params.id, path: resource }
            const putPayload: PutPostFhirPayload = { payload: params.payload }
            const response = await this.#fetcher(() => putFhir(this.#server, resourceIdentifier, putPayload), span)

            if (!response.ok) {
                const [responseError, operationOutcome] = await fhirResponseToFormattedError(response)

                span.setAttribute(FhirOtelAttributes.FhirResourceStatus, 'update-failed')
                failSpan(span, `Request to update (PUT) ${resourceType} failed`, responseError)

                if (this.#errorRecorder) {
                    assertErrorRecorderEnabled(this.#errorRecorder)
                    await this.#errorRecorder.add({
                        method: 'PUT',
                        resource: resourceIdentifier,
                        payload: putPayload,
                        error: operationOutcome ?? responseError,
                    })
                }

                switch (response.status) {
                    case 501: // not implemented, should never hit
                        fhirLogger.error(
                            `Server responded 501 to update ${resourceType}. This EHR (${this.#server.fhirServer}) is seriously misconfigured, contact the issuer.`,
                        )
                        return { error: 'CREATE_FAILED_NOT_SUPPORTED', operationOutcome }
                    case 404: // not implemented for updates
                    case 405: // the server does not support this verb on this resource
                        return { error: 'CREATE_FAILED_NOT_SUPPORTED', operationOutcome }
                    default:
                        return { error: 'CREATE_FAILED_NON_OK_RESPONSE', operationOutcome }
                }
            }

            const result = await response.json()
            const parsed = createResourceToSchema(resource).loose().safeParse(result)
            if (!parsed.success) {
                span.setAttribute(FhirOtelAttributes.FhirResourceStatus, 'parsing-failed')
                failSpan(span, `Failed to parse ${resourceType} (from PUT/update)`, parsed.error)

                return { error: 'CREATE_FAILED_INVALID_RESPONSE' }
            }

            void this.registerResourceValidation(parsed.data as ResponseForCreate<Path>)

            span.setAttribute(FhirOtelAttributes.FhirResourceStatus, 'update-succeeded')

            return parsed.data as ResponseForCreate<Path>
        })
    }

    public async request<Path extends KnownPaths>(
        resource: Path,
        /**
         * If set to true, will not mark the OTEL span as failed if the resource is not found.
         */
        config?: CacheableResource & { expectNotFound?: true },
    ): Promise<ResponseFor<Path> | ResourceRequestErrors> {
        const resourceType = inferResourceType(resource)

        return spanAsync(`read.${resourceType}`, async (span) => {
            span.setAttributes({
                [FhirOtelAttributes.FhirResource]: resourceType,
                [FhirOtelAttributes.FhirServer]: this.#server.fhirServer,
                [FhirOtelAttributes.ResourceCacheEnabled]: config?.cache != null,
            })

            if (config?.cache != null) {
                const cached = await getCachedResource<Path>(this.#cache, { session: this.#server, resource })
                if (cached) {
                    span.setAttributes({ [FhirOtelAttributes.ResourceCacheHit]: true })
                    return cached
                }
            }

            const doRequest = (): Promise<Response> => getFhir(this.#server, resource)
            const response = await this.#fetcher(
                () => (config?.expectNotFound ? squelchTracing(doRequest) : doRequest()),
                span,
            )

            if (!response.ok) {
                const [responseError, operationOutcome] = await fhirResponseToFormattedError(response)

                if (response.status === 404) {
                    span.setAttribute(FhirOtelAttributes.FhirResourceStatus, 'not-found')
                    if (!config?.expectNotFound) {
                        fhirLogger.warn(`Resource (${resource}) was not found on FHIR server`)
                    }
                    return { error: 'REQUEST_FAILED_RESOURCE_NOT_FOUND', operationOutcome: operationOutcome }
                }

                span.setAttribute(FhirOtelAttributes.FhirResourceStatus, 'request-failed')
                failSpan(span, `Request to get ${resource} failed`, responseError)

                return { error: 'REQUEST_FAILED_NON_OK_RESPONSE', operationOutcome: operationOutcome }
            }

            const result = await response.json()
            const parsed = resourceToSchema(resource).loose().safeParse(result)
            if (!parsed.success) {
                failSpan(span, `${resourceType} parse error`, parsed.error)
                return { error: 'REQUEST_FAILED_INVALID_RESPONSE' }
            }

            span.setAttribute(FhirOtelAttributes.FhirResourceStatus, 'resource-found')

            void this.registerResourceValidation(parsed.data as ResponseFor<Path>)

            if (config?.cache != null) {
                span.setAttribute(FhirOtelAttributes.ResourceCacheUpdated, true)
                await setCachedResource(
                    this.#cache,
                    { session: this.#server, resource, values: parsed.data as ResponseFor<Path> },
                    config.cache,
                )
            }

            return parsed.data as ResponseFor<Path>
        })
    }

    public async batch(
        type: 'batch' | 'transaction',
        resources: FhirBatchBundle['entry'],
    ): Promise<FhirBatchResponseBundle | ResourceBatchErrors> {
        return spanAsync(`batch.${type}`, async (span) => {
            span.setAttributes({
                [FhirOtelAttributes.FhirResource]: `Bundle(${type})`,
                [FhirOtelAttributes.FhirServer]: this.#server.fhirServer,
            })

            const response = await this.#fetcher(
                () =>
                    bundleFhir(this.#server, {
                        payload: {
                            resourceType: 'Bundle',
                            type: type,
                            entry: resources,
                        },
                    }),
                span,
            )

            if (!response.ok) {
                const [responseError, operationOutcome] = await fhirResponseToFormattedError(response)

                span.setAttribute(FhirOtelAttributes.FhirResourceStatus, 'batch-failed')
                failSpan(span, `Request for ${type} Bundle failed`, responseError)

                return { error: 'BATCH_FAILED_NON_OK_RESPONSE', operationOutcome } satisfies ResourceBatchErrors
            }

            const result = await response.json()
            const parsed = FhirBatchResponseBundleSchema.loose().safeParse(result)
            if (!parsed.success) {
                failSpan(span, `Failed to parse ${type} Bundle response`, parsed.error)
                return { error: 'BATCH_FAILED_INVALID_RESPONSE', operationOutcome: null } satisfies ResourceBatchErrors
            }

            const failed = parsed.data.entry.filter((entry) => !entry.response.status.startsWith('2'))
            if (failed.length === 0) {
                span.setAttribute(FhirOtelAttributes.FhirResourceStatus, 'batch-succeeded')

                return parsed.data
            } else if (failed.length === parsed.data.entry.length) {
                span.setAttribute(FhirOtelAttributes.FhirResourceStatus, 'batch-failed-all-failed')
                failSpan(span, `All entries in ${type} Bundle failed`)

                return { error: 'BATCH_FAILED_ALL_FAILED', result: parsed.data } satisfies ResourceBatchErrors
            } else {
                span.setAttribute(FhirOtelAttributes.FhirResourceStatus, 'batch-failed-some-ok')
                failSpan(span, `Some entries in ${type} Bundle failed`)

                return { error: 'BATCH_FAILED_SOME_OK', result: parsed.data } satisfies ResourceBatchErrors
            }
        })
    }

    public multi = multi

    private async registerResourceValidation<Path extends KnownPaths>(data: ResponseFor<Path>): Promise<void> {
        const validator = this.#validator
        if (validator == null) return

        return spanAsync(`validate.${data.resourceType}`, async (span) => {
            switch (data.resourceType) {
                case 'Encounter':
                    validator.encounter(data)
                    break
                case 'Patient':
                    validator.patient(data)
                    break
                case 'Organization':
                    validator.organization(data)
                    break
                case 'Practitioner':
                    validator.practitioner(data)
                    break
                case 'DocumentReference':
                    validator.documentReference(data)
                    break
                case 'QuestionnaireResponse':
                    validator.questionnaireResponse(data)
                    break
                case 'Bundle':
                    // Meh
                    break
                default:
                    const type = (data as { resourceType?: string }).resourceType ?? 'unknown'
                    failSpan(span, `No validator registered for resource type ${type}`)
                    fhirLogger.warn(`No validator registered for resource type ${type}`)
                    break
            }

            await spanAsync(`validate.persist-validation`, async () => this.#persistValidation?.())
        })
    }
}
