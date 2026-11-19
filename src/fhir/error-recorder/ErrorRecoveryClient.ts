import {
    type ErrorRecoveryStorage,
    type SafeErrorRecoveryStorage,
    safeErrorRecoveryStorage,
} from '#fhir/error-recorder/error-recovery-storage'

export class ErrorRecoveryClient {
    private readonly _storage: SafeErrorRecoveryStorage

    constructor(
        /**
         * Must be the exact same storage implementation used in the SmartClient
         */
        storage: ErrorRecoveryStorage | Promise<ErrorRecoveryStorage>,
    ) {
        this._storage = safeErrorRecoveryStorage(storage)
    }

    public outstandingErrorsCount(): number {
        return 4
    }

    public async processOutstandingErrors(max: Number = -1): Promise<{
        resolved: number
        reFailed: number
        remaining: number
    }> {
        return {
            resolved: 0,
            reFailed: 0,
            remaining: 0,
        }
    }
}
