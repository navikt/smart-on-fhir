import { removeTrailingSlash } from '#internal-lib/utils'

import type { FhirBatchBundle } from '../zod'

import type { FhirServer } from './fhir-servers'
import type { KnownCreatePaths } from './resources/create-resource-map'
import type { KnownPaths } from './resources/request-resource-map'

export type PutPostFhirPayload = {
    payload: unknown
}

export async function postFhir(
    server: FhirServer,
    path: KnownCreatePaths,
    { payload }: PutPostFhirPayload,
): Promise<Response> {
    const resourcePath = `${removeTrailingSlash(server.fhirServer)}/${path}`

    return await fetch(resourcePath, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
            ...maybeAuthHeaders(server),
            Accept: 'application/fhir+json,application/json',
            'Content-Type': 'application/fhir+json',
        },
    })
}

type BundleFhir = {
    payload: FhirBatchBundle
}

export async function bundleFhir(server: FhirServer, { payload }: BundleFhir): Promise<Response> {
    const resourcePath = `${removeTrailingSlash(server.fhirServer)}/Bundle`

    return await fetch(resourcePath, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
            ...maybeAuthHeaders(server),
            Accept: 'application/fhir+json,application/json',
            'Content-Type': 'application/fhir+json',
        },
    })
}

export type PutFhirResourceIdentifier = {
    path: KnownCreatePaths
    id: string
}

export async function putFhir(
    server: FhirServer,
    { path, id }: PutFhirResourceIdentifier,
    { payload }: PutPostFhirPayload,
): Promise<Response> {
    const resourcePath = `${removeTrailingSlash(server.fhirServer)}/${path}/${id}`

    return await fetch(resourcePath, {
        method: 'PUT',
        body: JSON.stringify(payload),
        headers: {
            ...maybeAuthHeaders(server),
            Accept: 'application/fhir+json,application/json',
            'Content-Type': 'application/fhir+json',
        },
    })
}

export async function getFhir(server: FhirServer, path: KnownPaths): Promise<Response> {
    const resourcePath = `${removeTrailingSlash(server.fhirServer)}/${path}`

    return await fetch(resourcePath, {
        method: 'GET',
        headers: {
            ...maybeAuthHeaders(server),
            Accept: 'application/fhir+json,application/json',
        },
    })
}

function maybeAuthHeaders(server: FhirServer): { Authorization?: string } {
    return 'accessToken' in server ? { Authorization: `Bearer ${server.accessToken}` } : {}
}
