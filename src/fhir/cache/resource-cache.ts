import type { FhirServer } from '../fhir-servers'
import type { KnownPaths, ResponseFor } from '../resources/request-resource-map'

import { getCachedResourceCustom, setCachedResourceCustom } from './resource-cache-custom'
import { getCachedResourceInMemory, setCachedResourceInMemory } from './resource-cache-inmem'

import type { CacheOptions } from './index'

export type CacheItem<Path extends KnownPaths> = {
    session: FhirServer
    resource: Path
}

export type CacheValueItem<Path extends KnownPaths> = CacheItem<Path> & {
    values: ResponseFor<Path>
}

export async function getCachedResource<Path extends KnownPaths>(
    cacheOptions: CacheOptions,
    item: CacheItem<Path>,
): Promise<ResponseFor<Path> | null> {
    if (cacheOptions === 'disabled') {
        throw Error('Invariant violation: attempted to get cache, but cache is disabled')
    }

    if (cacheOptions === 'in-memory') {
        return getCachedResourceInMemory(item)
    }

    return getCachedResourceCustom(cacheOptions, item)
}

export async function setCachedResource<Path extends KnownPaths>(
    cacheOptions: CacheOptions,
    item: CacheValueItem<Path>,
    cache: { ttl: number },
): Promise<void> {
    if (cacheOptions === 'disabled') {
        throw Error('Invariant violation: attempted to set cache, but cache is disabled')
    }

    if (cacheOptions === 'in-memory') {
        setCachedResourceInMemory(item, cache)
        return
    }

    await setCachedResourceCustom(cacheOptions, item, cache)
}
