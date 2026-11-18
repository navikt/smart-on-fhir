import { expect, test } from 'vitest'
import * as z from 'zod'

import { createLaunchableOpenSmartClient, validExampleSession } from '../internal/test-utils/client-open'
import { expectIs } from '../internal/test-utils/expect'
import { mockJwks, mockSmartConfiguration } from '../internal/test-utils/mocks/issuer'
import { createOtherToken, createTestAccessToken, createTestIdToken } from '../internal/test-utils/token'
import { ReadyClient } from '../smart'

test('.validate - should properly validate token', async () => {
    const [client] = await createLaunchableOpenSmartClient({
        ...validExampleSession,
        accessToken: await createTestAccessToken(60 * 10), // 10 minutes
    })

    const ready = await client.ready()
    expectIs(ready, ReadyClient)

    mockSmartConfiguration()
    mockJwks()
    const validToken = await ready.validate()

    expect(validToken).toBe(true)
})

test('.validate - should not validate expired token', async () => {
    const [client] = await createLaunchableOpenSmartClient({
        ...validExampleSession,
        accessToken: await createTestAccessToken(-60), // 1 minute expired
    })

    const ready = await client.ready()
    expectIs(ready, ReadyClient)

    mockSmartConfiguration()
    mockJwks()
    const validToken = await ready.validate()

    expect(validToken).toBe(false)
})

test('.validate - should not validate garbage', async () => {
    const [client] = await createLaunchableOpenSmartClient({
        ...validExampleSession,
        accessToken: 'straight.up.garbage',
    })

    const ready = await client.ready()
    expectIs(ready, ReadyClient)

    mockSmartConfiguration()
    mockJwks()
    const validToken = await ready.validate()

    expect(validToken).toBe(false)
})

test('.getClaim - should handle getting arbitrary claims and validating them with zod', async () => {
    const [client] = await createLaunchableOpenSmartClient({
        ...validExampleSession,
        idToken: await createTestIdToken({
            'https://helseid.nhn.no': {
                access_token: await createOtherToken('https://helseid.nhn.no'),
                issuer: 'https://helseid.nhn.no',
                scope: 'nav:syk-inn',
            },
        }),
    })

    const ready = await client.ready()
    expectIs(ready, ReadyClient)

    const claim = ready.getClaim('https://helseid.nhn.no')
    expect(claim).not.toBeNull()

    const parsedClaim = ready.getClaim(
        'https://helseid.nhn.no',
        z.object({
            access_token: z.string(),
            issuer: z.string(),
            scope: z.string(),
        }),
    )

    expect(parsedClaim).toEqual({
        access_token: expect.any(String),
        issuer: 'https://helseid.nhn.no',
        scope: 'nav:syk-inn',
    })
})
