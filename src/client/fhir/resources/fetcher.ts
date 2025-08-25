import type { KnownCreatePaths } from './create-resource-map'
import type { KnownPaths } from './resource-map'

type AuthenticatedServer = {
    server: string
    accessToken: string
}

type PostFhir = {
    payload: unknown
}

export async function postFhir(
    server: AuthenticatedServer,
    path: KnownCreatePaths,
    { payload }: PostFhir,
): Promise<Response> {
    const resourcePath = `${server.server}/${path}`

    return await fetch(resourcePath, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
            Authorization: `Bearer ${server.accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
    })
}

type PutFhir = {
    path: KnownCreatePaths
    id: string
}

export async function putFhir(
    server: AuthenticatedServer,
    { path, id }: PutFhir,
    { payload }: PostFhir,
): Promise<Response> {
    const resourcePath = `${server.server}/${path}/${id}`

    return await fetch(resourcePath, {
        method: 'PUT',
        body: JSON.stringify(payload),
        headers: {
            Authorization: `Bearer ${server.accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
    })
}

export async function getFhir(server: AuthenticatedServer, path: KnownPaths): Promise<Response> {
    const resourcePath = `${server.server}/${path}`

    return await fetch(resourcePath, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${server.accessToken}`,
            Accept: 'application/fhir+json,application/json',
        },
    })
}
