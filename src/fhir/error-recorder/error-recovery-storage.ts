import type { NewRecoverableRequest, RecoverableRequest } from '#fhir/error-recorder/error-recovery-types'

export type ErrorRecoveryStorage = {
    record: (key: string, json: unknown) => Promise<void>
    take: (key: string) => Promise<unknown[]>
    keys: () => Promise<string[]>
}

export type SafeErrorRecoveryStorage = {
    record: (key: string, request: NewRecoverableRequest) => Promise<void>
    update: (key: string, request: RecoverableRequest) => Promise<void>
    take: (key: string) => Promise<RecoverableRequest[]>
    keys: () => Promise<string[]>
}

export function safeErrorRecoveryStorage(
    errorRecoveryStorage: ErrorRecoveryStorage | Promise<ErrorRecoveryStorage>,
): SafeErrorRecoveryStorage {
    return {
        record: async (key, error) => {
            const storage = await errorRecoveryStorage
            return storage.record(key, {
                path: error.path,
                method: error.method,
                payload: error.payload,
                fhirServer: error.fhirServer,
                error: {
                    operationOutcome: error.operationOutcome,
                    message: error.error.message,
                    stack: error.error.stack ?? null,
                },
                recordedAt: new Date().toISOString(),
                attempts: 0,
            } satisfies RecoverableRequest)
        },
        update: async (key, error) => {
            const storage = await errorRecoveryStorage
            return storage.record(key, error)
        },
        take: async (key) => {
            const storage = await errorRecoveryStorage

            // TODO bad lol
            return (await storage.take(key)) as unknown as RecoverableRequest[]
        },
        keys: async () => {
            const storage = await errorRecoveryStorage
            return storage.keys()
        },
    }
}
