import QuickLRU from 'quick-lru'

import type { KnownPaths, ResponseFor } from '../fhir/resources/resource-map'

import type { CacheItem, CacheValueItem } from './resource-cache'

const resourceCache = new QuickLRU({
    maxSize: 1000,
})

export function setCachedResourceInMemory<Path extends KnownPaths>(item: CacheValueItem<Path>, cache: { ttl: number }) {
    const key = `${item.session.server}|${item.resource}`

    resourceCache.set(key, item.values, { maxAge: cache.ttl })
}

export function getCachedResourceInMemory<Path extends KnownPaths>(item: CacheItem<Path>): ResponseFor<Path> | null {
    const key = `${item.session.server}|${item.resource}`

    if (!resourceCache.has(key)) return null

    return resourceCache.get(key) as ResponseFor<Path>
}
