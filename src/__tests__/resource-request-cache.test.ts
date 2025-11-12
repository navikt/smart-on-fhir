import QuickLRU from 'quick-lru'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import type { ResourceCache } from '../client/cache/resource-cache-custom'
import type { CompleteSession } from '../client/storage/schema'

import { mockPractitioner } from './mocks/resources'
import { expectHas } from './utils/expect'
import { createTestIdToken } from './utils/token'

const validSession: CompleteSession = {
    // Initial
    server: 'http://fhir-server',
    issuer: 'http://fhir-auth-server',
    authorizationEndpoint: 'http://fhir-auth-server/authorize',
    tokenEndpoint: 'http://fhir-auth-server/token',
    codeVerifier: 'valid-code-verifier',
    state: 'valid-state',
    // Completed
    accessToken: 'valid-access-token',
    idToken: await createTestIdToken({
        fhirUser: 'Practitioner/ac768edb-d56a-4304-8574-f866c6af4e7e',
    }),
    refreshToken: 'valid-refresh-token',
    patient: 'valid-patient-id',
    encounter: 'valid-encounter-id',
}

beforeEach(() => {
    vi.useFakeTimers()
})

afterEach(() => {
    vi.resetModules()
    vi.useRealTimers()
})

describe('Inmemory Cache', () => {
    test('SmartClient.request - /Practitioner should fetch and cache Practitioner resource', async () => {
        const { createLaunchedOpenReadyClient } = await import('./utils/client-open')
        const cacheConfig = { cache: { ttl: 15 * 1000 } }

        const [ready] = await createLaunchedOpenReadyClient(validSession, undefined, 'in-memory')

        mockPractitioner('ac768edb-d56a-4304-8574-f866c6af4e7e')
        const practitioner = await ready.request(ready.user.fhirUser, cacheConfig)

        expectHas(practitioner, 'resourceType')
        expect(practitioner.resourceType).toBe('Practitioner')

        const cached = await ready.request(ready.user.fhirUser, cacheConfig)
        expect(practitioner).toBe(cached)
    })

    test('SmartClient.request - /Practitioner cache should respect ttl value', async () => {
        const { createLaunchedOpenReadyClient } = await import('./utils/client-open')
        const cacheConfig = { cache: { ttl: 15 * 1000 } }

        const [ready] = await createLaunchedOpenReadyClient(validSession, undefined, 'in-memory')

        mockPractitioner('ac768edb-d56a-4304-8574-f866c6af4e7e')
        const practitioner = await ready.request(ready.user.fhirUser, cacheConfig)

        // Still cached within TTL
        vi.advanceTimersByTime(14 * 1000)
        const cached = await ready.request(ready.user.fhirUser, cacheConfig)

        expect(practitioner).toBe(cached)

        // Move 1s past TTL
        vi.advanceTimersByTime(2 * 1000)
        await expect(async () => ready.request(ready.user.fhirUser, cacheConfig)).rejects.toThrow(
            'Nock: No match for request',
        )
    })

    test('SmartClient.user.request - /Practitioner should fetch and cache Practitioner resource', async () => {
        const { createLaunchedOpenReadyClient } = await import('./utils/client-open')
        const cacheConfig = { cache: { ttl: 15 * 1000 } }

        const [ready] = await createLaunchedOpenReadyClient(validSession, undefined, 'in-memory')

        mockPractitioner('ac768edb-d56a-4304-8574-f866c6af4e7e')
        const practitioner = await ready.user.request(cacheConfig)

        expectHas(practitioner, 'resourceType')
        expect(practitioner.resourceType).toBe('Practitioner')

        const cached = await ready.request(ready.user.fhirUser, cacheConfig)
        expect(practitioner).toBe(cached)
    })
})

describe('ResourceCache Cache', () => {
    function createTestCache(): ResourceCache {
        const inMem = new QuickLRU({ maxSize: 10 })

        return {
            set: async (sessionId, values, ttl) => {
                inMem.set(sessionId, values, { maxAge: ttl })
            },
            get: async (sessionId) => inMem.get(sessionId),
        }
    }

    test('SmartClient.request - /Practitioner should fetch and cache Practitioner resource', async () => {
        const { createLaunchedOpenReadyClient } = await import('./utils/client-open')
        const cacheConfig = { cache: { ttl: 15 * 1000 } }

        const cache = createTestCache()
        const [ready] = await createLaunchedOpenReadyClient(validSession, undefined, cache)

        mockPractitioner('ac768edb-d56a-4304-8574-f866c6af4e7e')
        const practitioner = await ready.request(ready.user.fhirUser, cacheConfig)

        expectHas(practitioner, 'resourceType')
        expect(practitioner.resourceType).toBe('Practitioner')

        const cached = await ready.request(ready.user.fhirUser, cacheConfig)
        expect(practitioner).toBe(cached)
    })

    test('SmartClient.request - Should use provided ResourceCache implementation if provided', async () => {
        const { createLaunchedOpenReadyClient } = await import('./utils/client-open')
        const cacheConfig = { cache: { ttl: 15 * 1000 } }

        const cache = createTestCache()
        const [ready] = await createLaunchedOpenReadyClient(validSession, undefined, cache)

        mockPractitioner('ac768edb-d56a-4304-8574-f866c6af4e7e')
        const practitioner = await ready.request(ready.user.fhirUser, cacheConfig)

        // Still cached within TTL
        vi.advanceTimersByTime(14 * 1000)
        const cached = await ready.request(ready.user.fhirUser, cacheConfig)
        expect(practitioner).toBe(cached)

        // Move 1s past TTL
        vi.advanceTimersByTime(2 * 1000)
        await expect(async () => ready.request(ready.user.fhirUser, cacheConfig)).rejects.toThrow(
            'Nock: No match for request',
        )
    })
})

test('No Cache - should not cache anything', async () => {
    const { createLaunchedOpenReadyClient } = await import('./utils/client-open')
    const [ready] = await createLaunchedOpenReadyClient(validSession, undefined, 'disabled')

    const scope = mockPractitioner('ac768edb-d56a-4304-8574-f866c6af4e7e')
    mockPractitioner('ac768edb-d56a-4304-8574-f866c6af4e7e')
    const practitioner = await ready.request(ready.user.fhirUser)

    expectHas(practitioner, 'resourceType')
    expect(practitioner.resourceType).toBe('Practitioner')

    const cached = await ready.request(ready.user.fhirUser)
    expect(practitioner).not.toBe(cached)

    expect(scope.pendingMocks()).toHaveLength(0)
})

test('No Cache - attempting to cache a request with no cache configured should fail', async () => {
    const { createLaunchedOpenReadyClient } = await import('./utils/client-open')
    const [ready] = await createLaunchedOpenReadyClient(validSession, undefined, 'disabled')

    mockPractitioner('ac768edb-d56a-4304-8574-f866c6af4e7e')

    await expect(() => ready.request(ready.user.fhirUser, { cache: { ttl: 15 * 1000 } })).rejects.toThrow(
        'Invariant violation: attempted to get cache, but cache is disabled',
    )
})
