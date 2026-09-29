import type { SmartClient } from '../client'
import type { CompleteSession } from '../client/storage/schema'

import type { MockReadyClientOptions } from './MockReadyClient'

export function mockClient(): SmartClient {
    return { options: { cache: 'disabled' } } as SmartClient
}

export function mockSession(options: MockReadyClientOptions): CompleteSession {
    const claims = { ...options.claims, fhirUser: `Practitioner/${options.userId}` }
    return {
        patient: options.patientId,
        encounter: options.encounterId,
        idToken: `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.e30`,
    } as CompleteSession
}
