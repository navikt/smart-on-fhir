import QuickLRU from 'quick-lru'

import { removeTrailingSlash } from '#internal-lib/utils'

import type { KnownPaths, ResponseFor } from '../resources/request-resource-map'

import type { CacheItem, CacheValueItem } from './resource-cache'

const resourceCache = new QuickLRU({
    maxSize: 1000,
})

export function setCachedResourceInMemory<Path extends KnownPaths>(
    item: CacheValueItem<Path>,
    cache: { ttl: number },
): void {
    const key = `${removeTrailingSlash(item.session.fhirServer)}|${item.resource}`

    resourceCache.set(key, item.values, { maxAge: cache.ttl })
}

export function getCachedResourceInMemory<Path extends KnownPaths>(item: CacheItem<Path>): ResponseFor<Path> | null {
    const key = `${removeTrailingSlash(item.session.fhirServer)}|${item.resource}`

    if (!resourceCache.has(key)) return null

    return resourceCache.get(key) as ResponseFor<Path>
}
