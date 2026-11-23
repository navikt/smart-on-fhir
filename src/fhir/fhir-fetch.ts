import type { Span } from '@opentelemetry/api'

import { fhirResponseToFormattedError } from '#fhir/fhir-fetch-errors'
import { createTracing, failSpan } from '#internal-lib/otel'
import { removeTrailingSlash } from '#internal-lib/utils'
import type { FhirBatchBundle, OperationOutcome } from '#zod'

import { FhirOtelAttributes } from './fhir-otel'
import type { FhirServer } from './fhir-servers'
import type { KnownCreatePaths } from './resources/create-resource-map'
import type { KnownPaths } from './resources/request-resource-map'

const { spanAsync } = createTracing('fhir')

export type FhirFetchResult =
    | {
          success: true
          response: Response
      }
    | {
          errorType: 'non-ok'
          success: false
          response: Response
          error: Error
          operationOutcome: OperationOutcome | null
      }
    | {
          errorType: 'fetch-failed'
          success: false
          error: Error
      }

type PutPostFhirPayload = {
    payload: unknown
}

export async function postFhir(
    server: FhirServer,
    path: KnownCreatePaths,
    { payload }: PutPostFhirPayload,
): Promise<FhirFetchResult> {
    return spanAsync('fhir.post', async (span) => {
        const resourcePath = `${removeTrailingSlash(server.fhirServer)}/${path}`
        span.setAttribute(`${FhirOtelAttributes.FhirFetch}.url`, resourcePath)

        try {
            const response = await fetch(resourcePath, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: {
                    ...maybeAuthHeaders(server),
                    Accept: 'application/fhir+json,application/json',
                    'Content-Type': 'application/fhir+json',
                },
            })

            return handleFhirResponse(response, span)
        } catch (e) {
            const error = e instanceof Error ? e : new Error('Unknown error during fhir-fetch', { cause: e })

            failSpan(span, 'Fetch (post) failed', error, {
                [`${FhirOtelAttributes.FhirFetch}.success`]: 'fetch-failed',
            })

            return { success: false, error: error, errorType: 'fetch-failed' }
        }
    })
}

type BundleFhir = {
    payload: FhirBatchBundle
}

export async function bundleFhir(server: FhirServer, { payload }: BundleFhir): Promise<FhirFetchResult> {
    return spanAsync('fhir.bundle', async (span) => {
        const resourcePath = `${removeTrailingSlash(server.fhirServer)}/Bundle`
        span.setAttribute(`${FhirOtelAttributes.FhirFetch}.url`, resourcePath)

        try {
            const response = await fetch(resourcePath, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: {
                    ...maybeAuthHeaders(server),
                    Accept: 'application/fhir+json,application/json',
                    'Content-Type': 'application/fhir+json',
                },
            })

            return handleFhirResponse(response, span)
        } catch (e) {
            const error = e instanceof Error ? e : new Error('Unknown error during fhir-fetch', { cause: e })

            failSpan(span, 'Fetch (post bundle) failed', error, {
                [`${FhirOtelAttributes.FhirFetch}.success`]: 'fetch-failed',
            })

            return { success: false, error: error, errorType: 'fetch-failed' }
        }
    })
}

type PutFhir = {
    path: KnownCreatePaths
    id: string
}

export async function putFhir(
    server: FhirServer,
    { path, id }: PutFhir,
    { payload }: PutPostFhirPayload,
): Promise<FhirFetchResult> {
    return spanAsync('fhir.put', async (span) => {
        const resourcePath = `${removeTrailingSlash(server.fhirServer)}/${path}/${id}`
        span.setAttribute(`${FhirOtelAttributes.FhirFetch}.url`, resourcePath)

        try {
            const response = await fetch(resourcePath, {
                method: 'PUT',
                body: JSON.stringify(payload),
                headers: {
                    ...maybeAuthHeaders(server),
                    Accept: 'application/fhir+json,application/json',
                    'Content-Type': 'application/fhir+json',
                },
            })

            return handleFhirResponse(response, span)
        } catch (e) {
            const error = e instanceof Error ? e : new Error('Unknown error during fhir-fetch', { cause: e })

            failSpan(span, 'Fetch (put) failed', error, {
                [`${FhirOtelAttributes.FhirFetch}.success`]: 'fetch-failed',
            })

            return { success: false, error: error, errorType: 'fetch-failed' }
        }
    })
}

export async function getFhir(server: FhirServer, path: KnownPaths): Promise<FhirFetchResult> {
    return spanAsync('fhir.get', async (span) => {
        const resourcePath = `${removeTrailingSlash(server.fhirServer)}/${path}`
        span.setAttribute(`${FhirOtelAttributes.FhirFetch}.url`, resourcePath)

        try {
            const response = await fetch(resourcePath, {
                method: 'GET',
                headers: {
                    ...maybeAuthHeaders(server),
                    Accept: 'application/fhir+json,application/json',
                },
            })
            return handleFhirResponse(response, span)
        } catch (e) {
            const error = e instanceof Error ? e : new Error('Unknown error during fhir-fetch', { cause: e })

            failSpan(span, 'Fetch (post) failed', error, {
                [`${FhirOtelAttributes.FhirFetch}.success`]: 'fetch-failed',
            })

            return { success: false, error: error, errorType: 'fetch-failed' }
        }
    })
}

function maybeAuthHeaders(server: FhirServer): { Authorization?: string } {
    return 'accessToken' in server ? { Authorization: `Bearer ${server.accessToken}` } : {}
}

async function handleFhirResponse(response: Response, span: Span): Promise<FhirFetchResult> {
    span.setAttributes({
        [`${FhirOtelAttributes.FhirFetch}.status`]: response.status,
        [`${FhirOtelAttributes.FhirFetch}.success`]: response.ok,
    })

    if (response.ok) {
        return {
            success: true,
            response,
        }
    } else {
        const [error, operationOutcome] = await fhirResponseToFormattedError(response)

        return {
            success: false,
            error: error,
            response: response,
            operationOutcome: operationOutcome,
            errorType: 'non-ok',
        }
    }
}
