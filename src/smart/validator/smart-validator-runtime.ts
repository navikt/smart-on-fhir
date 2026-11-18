// oxlint-disable typescript/no-explicit-any no-unused-vars - This type of validation requires actual any

import { decodeJwt } from 'jose'

import { BaseValidator } from '../../internal/validator/base-validator'
import { now } from '../../internal/validator/utils'
import type { Loosely, Validations } from '../../internal/validator/validations'
import { ValidatorBuilder } from '../../internal/validator/validator-builder'
import { IdTokenSchema, type TokenRefreshResponse, type TokenResponse } from '../launch/token/token-schema'
import type { SmartConfiguration } from '../launch/well-known/smart-configuration-schema'
import { smartLogger } from '../smart-logger'

import { type SmartValidation, type SmartValidationType, allSmartValidations } from './validations'

/**
 * The validator runtime is used as an internal mechanism to validate the operations and
 * communication with the FHIR server. It allows the consumer to request a report after
 * the fact to identify any discrepancies with how the launch and FHIR resources should behave.
 *
 * The validator is designed to be used over several requests, and provide mechanisms to merge
 * in previous partial reports from previous steps as to always have a complete timeline for
 * the session.
 */
export class SmartValidatorRuntime extends BaseValidator<SmartValidationType> {
    constructor() {
        const initial = Object.fromEntries(
            allSmartValidations.map(
                (type) => [type, { type, at: now(), status: 'UNVALIDATED' } satisfies SmartValidation] as const,
            ),
        ) as Validations<SmartValidationType>

        super(initial)
    }

    smartConfiguration(sc: SmartConfiguration & Loosely): void {
        const outcomes = new ValidatorBuilder('SMART_CONFIGURATION')

        try {
            outcomes
                .whenValueExists(sc.grant_types_supported, 'grant_types_supported', 'required')
                .thenCheck<string[]>({
                    test: (value) => value.includes('refresh_token'),
                    yeah: { type: 'OK', message: 'refresh_token is supported' },
                    nah: { type: 'WARNING', message: 'refresh_token is not supported' },
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
                        type: 'OK',
                        message: `token_endpoint_auth_methods_supported supports at least one of ${expectedClientCredentialsTypes.join(', ')}`,
                    },
                    nah: {
                        type: 'ERROR',
                        message: `token_endpoint_auth_methods_supported is missing support for at least one of ${expectedClientCredentialsTypes.join(', ')}`,
                    },
                })

            this.update(outcomes)
        } catch (e) {
            smartLogger.warn(new Error('SMART_CONFIGURATION validation failed, ignoring', { cause: e }))
        }
    }

    tokenResponse(tr: TokenResponse & Loosely): void {
        const outcomes = new ValidatorBuilder('TOKEN_RESPONSE')

        try {
            outcomes.check({
                test: tr['practitioner'] != null,
                yeah: { type: 'WARNING', message: 'practitioner should not be part of the token response' },
            })

            this.update(outcomes)

            /**
             * Token response has id_token, we'll chain it automatically
             */
            this.idToken(tr.id_token)
        } catch (e) {
            smartLogger.warn(new Error('TOKEN_RESPONSE validation failed, ignoring', { cause: e }))
        }
    }

    tokenRefreshResponse(tr: TokenRefreshResponse & Loosely): void {
        const outcomes = new ValidatorBuilder('TOKEN_REFRESH_RESPONSE')

        try {
            outcomes.check({
                test: tr['encounter'] != null,
                yeah: { type: 'WARNING', message: 'encounter should not be part of the token refresh response' },
            })

            outcomes.check({
                test: tr['patient'] != null,
                yeah: { type: 'WARNING', message: 'patient should not be part of the token refresh response' },
            })

            outcomes.check({
                test: tr['practitioner'] != null,
                yeah: { type: 'WARNING', message: 'practitioner should not be part of the token refresh response' },
            })

            this.update(outcomes)
        } catch (e) {
            smartLogger.warn(new Error('TOKEN_REFRESH_RESPONSE validation failed, ignoring', { cause: e }))
        }
    }

    private idToken(idToken: string): void {
        try {
            const outcomes = new ValidatorBuilder('ID_TOKEN')
            const decoded = decodeJwt(idToken)
            const parsed = IdTokenSchema.loose().parse(decoded)

            outcomes.check({
                test: parsed.fhirUser.startsWith('Practitioner/'),
                nah: { type: 'ERROR', message: 'fhirUser should be a Practitioner resource' },
            })

            this.update(outcomes)
        } catch (e) {
            smartLogger.warn(new Error('ID_TOKEN validation failed, ignoring', { cause: e }))
        }
    }

    restore(persisted: string | undefined | null): void {
        // Nothing to restore
        if (persisted == null) return

        const parsed = JSON.parse(persisted)
        if (typeof parsed !== 'object' || Object.keys(parsed).length !== allSmartValidations.length) {
            smartLogger.warn('Invalid persisted validator runtime state, ignoring')
            return
        }

        const state = parsed as Validations<SmartValidationType>
        for (const validation of allSmartValidations) {
            if (this.validations[validation].status === 'UNVALIDATED') {
                // Always overwrite when current is unvalidated
                this.overwrite(state, validation)
                continue
            }

            if (state[validation].at > this.validations[validation].at) {
                // Only overwrite when persisted is newer than current
                this.overwrite(state, validation)
            }
        }
    }

    private overwrite<K extends SmartValidationType>(state: Validations<K>, key: K): void {
        const validations: Validations<K> = this.validations
        validations[key] = state[key]
    }
}
