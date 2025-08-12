import { ReadyClient, SmartClient, type SmartClientOptions, type SmartStorage } from '../../client'
import type { CompleteSession } from '../../client/storage/schema'

import { expectIs } from './expect'
import { createTestStorage } from './storage'

export const TEST_SESSION_ID = 'test-session'

export const createTestClient = (options?: SmartClientOptions): [SmartClient, SmartStorage] => {
    const storage = createTestStorage()

    const client = new SmartClient(
        TEST_SESSION_ID,
        storage,
        {
            clientId: 'test-client',
            scope: 'openid fhirUser launch/patient',
            callbackUrl: 'http://app/callback',
            redirectUrl: 'http://app/redirect',
            allowAnyIssuer: true,
        },
        options,
    )

    return [client, storage]
}

export async function createLaunchableSmartClient(
    session: CompleteSession,
    options?: SmartClientOptions,
): Promise<[SmartClient, SmartStorage]> {
    const [client, storage] = createTestClient(options)

    await storage.set('test-session', session)

    expectIs(client, SmartClient)

    return [client, storage]
}

export async function createLaunchedReadyClient(
    session: CompleteSession,
    options?: SmartClientOptions,
): Promise<[ReadyClient, SmartStorage]> {
    const [client, storage] = createTestClient(options)

    await storage.set(TEST_SESSION_ID, session)
    const ready = await client.ready()

    expectIs(ready, ReadyClient)

    return [ready, storage]
}
