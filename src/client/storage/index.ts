import { logger } from '../logger'

import { type CompleteSession, CompleteSessionSchema, type InitialSession, InitialSessionSchema } from './schema'
import type { CompleteSessionErrors, InitialSessionErrors } from './storage-errors'

export type SmartStorage = {
    set: (sessionId: string, values: InitialSession | CompleteSession) => Promise<void>
    get: (sessionId: string) => Promise<unknown>
}

export type SafeSmartStorage = {
    set: (sessionId: string, values: InitialSession | CompleteSession) => Promise<void>
    getPartial: (sessionId: string) => Promise<InitialSession | InitialSessionErrors>
    getComplete: (sessionId: string) => Promise<CompleteSession | CompleteSessionErrors>
}

export function safeSmartStorage(smartStorage: SmartStorage | Promise<SmartStorage>): SafeSmartStorage {
    return {
        set: async (...args) => {
            return (await smartStorage).set(...args)
        },
        getPartial: async (sessionId) => {
            const raw = await (await smartStorage).get(sessionId)

            if (raw == null) return { error: 'NO_STATE' }
            if (raw && typeof raw === 'object' && Object.keys(raw).length === 0) {
                return { error: 'NO_STATE' }
            }

            const initialParsed = InitialSessionSchema.safeParse(raw)
            if (initialParsed.error) {
                logger.error(
                    new Error(`SmartSession state for session ${sessionId} is broken`, {
                        cause: initialParsed.error,
                    }),
                )
                return { error: 'BROKEN_SESSION_STATE' }
            }

            return initialParsed.data
        },
        getComplete: async (sessionId) => {
            const raw = await (await smartStorage).get(sessionId)

            if (raw == null) return { error: 'NO_STATE' }
            if (raw && typeof raw === 'object' && Object.keys(raw).length === 0) {
                return { error: 'NO_STATE' }
            }

            const completeParsed = CompleteSessionSchema.safeParse(raw)
            if (completeParsed.error) {
                logger.error(
                    new Error(`SmartSession state for session ${sessionId} was expected to be complete, but wasn't`, {
                        cause: completeParsed.error,
                    }),
                )
                return { error: 'BROKEN_SESSION_STATE' }
            }

            return completeParsed.data
        },
    }
}
