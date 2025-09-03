import QuickLRU from 'quick-lru'

import type { SmartConfiguration } from './smart-configuration-schema'

const smartConfigurationCache = new QuickLRU<string, SmartConfiguration>({
    maxSize: 50,
    maxAge: 60 * 60 * 1000, // 1 hour
})

export function getCachedSmartConfiguration(url: string): SmartConfiguration | null {
    return smartConfigurationCache.get(url) || null
}

export function setSmartConfigurationCache(url: string, value: SmartConfiguration): void {
    smartConfigurationCache.set(url, value)
}

export function clearSmartConfigurationCache(): void {
    smartConfigurationCache.clear()
}
