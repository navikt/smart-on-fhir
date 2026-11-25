import type { NewRecoverableRequest } from '#fhir/error-recorder/error-recovery-types'

import type { SafeErrorRecoveryStorage } from './error-recovery-storage'

export class ErrorRecorder {
    readonly #key: string
    readonly #storage: SafeErrorRecoveryStorage

    constructor(options: { errorGroupKey: string; storage: SafeErrorRecoveryStorage }) {
        this.#key = options.errorGroupKey
        this.#storage = options.storage
    }

    public async record(failed: NewRecoverableRequest): Promise<void> {
        await this.#storage.record(this.#key, failed)
    }
}

export function assertErrorRecorderEnabled(
    errorRecorder: ErrorRecorder | undefined,
): asserts errorRecorder is ErrorRecorder {
    if (!errorRecorder) {
        throw new Error(
            'ErrorRecorder is not enabled. Please provide an ErrorRecorder instance when creating the FhirClient.',
        )
    }
}
