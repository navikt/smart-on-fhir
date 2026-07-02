// oxlint-disable typescript/no-explicit-any - This type of validation requires actual any

import { logger } from '../smart/lib/logger'
import type { TokenRefreshResponse, TokenResponse } from '../smart/token/token-schema'
import type { SmartConfiguration } from '../smart/well-known/smart-configuration-schema'

import {
    activeValidations,
    type Validation,
    type ValidationOverallOutcome,
    type ValidationTestLevel,
    type ValidationType,
} from './validations'

/**
 * The validator runtime is used as an internal mechanism to validate the operations and
 * communication with the FHIR server. It allows the consumer to request a report after
 * the fact to identify any discrepancies with how the launch and FHIR resources should behave.
 *
 * The validator is designed to be used over several requests, and provide mechanisms to merge
 * in previous partial reports from previous steps as to always have a complete timeline for
 * the session.
 */
export class ValidatorRuntime {
    private readonly validations: Record<ValidationType, Validation>

    static blank(): ValidatorRuntime {
        return new ValidatorRuntime()
    }

    private constructor() {
        this.validations = Object.fromEntries(
            activeValidations.map(
                (type) => [type, { type, at: now(), status: 'UNVALIDATED' } satisfies Validation] as const,
            ),
        ) as Record<ValidationType, Validation>
    }

    smartConfiguration(sc: SmartConfiguration & Loosely): void {
        const outcomes = new ValidatorBuilder('SMART_CONFIGURATION')

        outcomes.whenValueExists(sc.grant_types_supported, 'grant_types_supported', 'required').thenCheck<string[]>({
            test: (value) => value.includes('refresh_token'),
            yeah: { type: 'INFO', message: 'refresh_token is supported' },
            nah: { type: 'WARN', message: 'refresh_token is not supported' },
        })

        const expectedClientCredentialsTypes = ['private_key_jwt', 'client_secret_post', 'client_secret_basic']
        outcomes
            .whenValueExists(
                sc.token_endpoint_auth_methods_supported,
                'token_endpoint_auth_methods_supported',
                'required',
            )
            .thenCheck<string[]>({
                test: (value) => expectedClientCredentialsTypes.some((method) => value.includes(method)),
                yeah: {
                    type: 'INFO',
                    message: `token_endpoint_auth_methods_supported supports at least one of ${expectedClientCredentialsTypes.join(', ')}`,
                },
                nah: {
                    type: 'ERROR',
                    message: `token_endpoint_auth_methods_supported is missing support for at least one of ${expectedClientCredentialsTypes.join(', ')}`,
                },
            })

        this.update(outcomes)
    }

    // oxlint-disable-next-line no-unused-vars
    tokenResponse(tokenResponse: TokenResponse & Loosely): void {}

    // oxlint-disable-next-line no-unused-vars
    tokenRefreshResponse(tokenResponse: TokenRefreshResponse & Loosely): void {}

    /* TODO:
    encounter(encounter: FhirEncounter & Loosely): void {}

    practitioner(practitioner: FhirPractitioner & Loosely): void {}

    patient(patient: FhirPatient & Loosely): void {}

    organization(organization: FhirOrganization & Loosely): void {}

    documentReference(dr: FhirDocumentReference & Loosely): void {}
    */

    report(): Validation[] {
        return Object.values(this.validations)
    }

    export(): Record<ValidationType, Validation> {
        return this.validations
    }

    restore(persisted: unknown): void {
        // Nothing to restore
        if (persisted == null) return

        if (typeof persisted !== 'object' || Object.keys(persisted).length !== activeValidations.length) {
            logger.warn('Invalid persisted validator runtime state, ignoring')
            return
        }

        const state = persisted as Record<ValidationType, Validation>
        for (const validation of activeValidations) {
            if (this.validations[validation].status === 'UNVALIDATED') {
                // Always overwrite when current is unvalidated
                this.validations[validation] = state[validation]
                continue
            }

            if (state[validation].at > this.validations[validation].at) {
                // Only overwrite when persisted is newer than current
                this.validations[validation] = state[validation]
            }
        }
    }

    private update(validation: ValidatorBuilder): void {
        const result = validation.toValidation()
        this.validations[result.type] = result
    }
}

/**
 * Used to build a set of tests for a ValidationType, has utilities for working with uncertain
 * datastructures and nullability.
 */
class ValidatorBuilder {
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
        yeah: { type: ValidationTestLevel; message: string }
        nah: { type: ValidationTestLevel; message: string }
    }): void {
        if (check.test) {
            this.outcomes.push({ type: check.yeah.type, message: check.yeah.message })
        } else {
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

const now = (): string => new Date().toISOString()

export type Loosely = {
    [key: string]: any
}
