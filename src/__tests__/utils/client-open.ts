import { ReadyClient, SmartClient, type SmartClientOptions } from '../../client'
import type { CacheOptions } from '../../client/cache'
import { type SafeSmartStorage, safeSmartStorage } from '../../client/storage'
import type { CompleteSession } from '../../client/storage/schema'

import { expectIs } from './expect'
import { createTestStorage } from './storage'

export const TEST_SESSION_ID = 'test-session'

function createOpenTestClient(options?: SmartClientOptions, cache?: CacheOptions): [SmartClient, SafeSmartStorage] {
    const storage = createTestStorage()

    const client = new SmartClient(
        TEST_SESSION_ID,
        {
            clientId: 'test-client',
            scope: 'openid fhirUser launch/patient',
            callbackUrl: 'http://app/callback',
            redirectUrl: 'http://app/redirect',
            allowAnyIssuer: true,
        },
        { storage, options, cache },
    )

    return [client, safeSmartStorage(storage)]
}

export async function createLaunchableOpenSmartClient(
    session: CompleteSession,
    options?: SmartClientOptions,
): Promise<[SmartClient, SafeSmartStorage]> {
    const [client, storage] = createOpenTestClient(options)

    await storage.set('test-session', session)

    expectIs(client, SmartClient)

    return [client, storage]
}

export async function createLaunchedOpenReadyClient(
    session: CompleteSession,
    options?: SmartClientOptions,
    cache?: CacheOptions,
): Promise<[ReadyClient, SafeSmartStorage]> {
    const [client, storage] = createOpenTestClient(options, cache)

    await storage.set(TEST_SESSION_ID, session)
    const ready = await client.ready()

    expectIs(ready, ReadyClient)

    return [ready, storage]
}
