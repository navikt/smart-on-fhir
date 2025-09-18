import type { ResourceCache } from './resource-cache-custom'

/**
 * The backing cache for fetching resources. Each resource request still needs to opt in to caching on
 * a per request(...) basis.
 */
export type CacheOptions = 'disabled' | 'in-memory' | ResourceCache | Promise<ResourceCache>

export { getCachedResource, setCachedResource } from './resource-cache'
