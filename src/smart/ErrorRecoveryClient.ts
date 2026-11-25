import {
    type ErrorRecoveryStorage,
    type SafeErrorRecoveryStorage,
    safeErrorRecoveryStorage,
} from '#fhir/error-recorder/error-recovery-storage'
import { safeSmartStorage, type SafeSmartStorage, type SmartStorage } from '#smart/storage'

export class ErrorRecoveryClient {
    readonly #smartStorage: SafeSmartStorage
    readonly #errorStorage: SafeErrorRecoveryStorage

    constructor(
        /**
         * Must be the exact same storage implementation used in the SmartClient
         */
        smartStorage: SmartStorage | Promise<SmartStorage>,
        /**
         * Must be the exact same storage implementation used in the SmartClient
         */
        errorStorage: ErrorRecoveryStorage | Promise<ErrorRecoveryStorage>,
    ) {
        this.#smartStorage = safeSmartStorage(smartStorage)
        this.#errorStorage = safeErrorRecoveryStorage(errorStorage)
    }

    public outstandingErrorsCount(): Promise<number> {
        return this.#errorStorage.keys().then((it) => it.length)
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
