import type { FhirBatchBundle } from '../../zod'
import { removeTrailingSlash } from '../smart/lib/utils'

import type { KnownCreatePaths } from './resources/create-resource-map'
import type { KnownPaths } from './resources/request-resource-map'
import type { FhirServer } from './servers'

type PostFhir = {
    payload: unknown
}

export async function postFhir(server: FhirServer, path: KnownCreatePaths, { payload }: PostFhir): Promise<Response> {
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

type PutFhir = {
    path: KnownCreatePaths
    id: string
}

export async function putFhir(server: FhirServer, { path, id }: PutFhir, { payload }: PostFhir): Promise<Response> {
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
