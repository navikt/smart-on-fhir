import type { RecoverableRequests } from '#fhir/error-recorder/error-recovery-types'

export type ErrorRecoveryStorage = {
    add: (key: string, request: unknown) => Promise<void>
    claim: (key: string) => Promise<unknown>
    update: (key: string, error: unknown) => Promise<void>
    count: () => Promise<number>
}

export type SafeErrorRecoveryStorage = {
    add: (key: string, request: RecoverableRequests) => Promise<void>
    claim: (key: string) => Promise<RecoverableRequests>
    update: (key: string, error: unknown) => Promise<void>
    count: () => Promise<number>
}

export function safeErrorRecoveryStorage(
    errorRecoveryStorage: ErrorRecoveryStorage | Promise<ErrorRecoveryStorage>,
): SafeErrorRecoveryStorage {
    return {
        add: async (key, request) => {
            const storage = await errorRecoveryStorage
            return storage.add(key, request)
        },
        claim: async (key) => {
            const storage = await errorRecoveryStorage
            return storage.claim(key)
        },
        update: async (key, error) => {
            const storage = await errorRecoveryStorage
            return storage.update(key, error)
        },
        count: async () => {
            const storage = await errorRecoveryStorage
            return storage.count()
        },
    }
}
