// oxlint-disable typescript/no-explicit-any - This type of validation requires actual any

import { now } from './utils'
import type { Validation, ValidationOverallOutcome, ValidationTestLevel, ValidationType } from './validations'

/**
 * Used to build a set of tests for a ValidationType, has utilities for working with uncertain
 * datastructures and nullability.
 */
export class ValidatorBuilder {
    private readonly type: ValidationType
    private readonly outcomes: { type: 'INFO' | 'WARN' | 'ERROR'; message: string }[] = []

    constructor(type: ValidationType) {
        this.type = type
    }

    whenValueExists(
        value: any,
        what: string,
        required: 'required' | 'ignore',
    ): {
        thenCheck: <AssumedType>(check: {
            test: (value: AssumedType) => boolean
            yeah: { type: string; message: string }
            nah: { type: string; message: string }
        }) => void
    } {
        if (value == null) {
            const noop = (): void => void 0
            if (required == 'ignore') return { thenCheck: () => noop }

            this.outcomes.push({ type: 'ERROR', message: `${what} is missing` })
            return { thenCheck: () => noop }
        }

        return {
            thenCheck: (check) => {
                const result = check.test(value)
                if (result) {
                    this.outcomes.push({
                        type: check.yeah.type as 'INFO' | 'WARN' | 'ERROR',
                        message: check.yeah.message,
                    })
                } else {
                    this.outcomes.push({
                        type: check.nah.type as 'INFO' | 'WARN' | 'ERROR',
                        message: check.nah.message,
                    })
                }
            },
        }
    }

    check(check: {
        test: boolean
        yeah?: { type: ValidationTestLevel; message: string }
        nah?: { type: ValidationTestLevel; message: string }
    }): void {
        if (check.test && check.yeah) {
            this.outcomes.push({ type: check.yeah.type, message: check.yeah.message })
        } else if (!check.test && check.nah) {
            this.outcomes.push({ type: check.nah.type, message: check.nah.message })
        }
    }

    toValidation(): Validation {
        const anyError = this.outcomes.some((o) => o.type === 'ERROR')
        const anyWarn = this.outcomes.some((o) => o.type === 'WARN')

        const status: ValidationOverallOutcome = anyError ? 'FAIL' : anyWarn ? 'PASS' : 'GOOD'

        return { type: this.type, at: now(), status: status, tests: this.outcomes }
    }
}
