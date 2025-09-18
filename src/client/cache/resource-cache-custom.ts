import type { KnownPaths, ResponseFor } from '../fhir/resources/resource-map'

import type { CacheItem } from './resource-cache'

export type ResourceCache = {
    set: (
        key: string,
        values: unknown,
        /**
         * Time in milliseconds until the cache entry expires
         *
         * MUST be respected by the ResourceCache implementation
         */
        ttl: number,
    ) => Promise<void>
    get: (key: string) => Promise<unknown | null>
}

export async function getCachedResourceCustom<Path extends KnownPaths>(
    cache: ResourceCache | Promise<ResourceCache>,
    item: CacheItem<Path>,
): Promise<ResponseFor<Path> | null> {
    const key = `${item.session.server}|${item.resource}`

    const itemInCache = await (await cache).get(key)

    return itemInCache as ResponseFor<Path> | null
}

export async function setCachedResourceCustom<Path extends KnownPaths>(
    cache: ResourceCache | Promise<ResourceCache>,
    item: CacheItem<Path> & { values: ResponseFor<Path> },
    cacheOptions: { ttl: number },
): Promise<void> {
    const key = `${item.session.server}|${item.resource}`

    return (await cache).set(key, item.values, cacheOptions.ttl)
}
