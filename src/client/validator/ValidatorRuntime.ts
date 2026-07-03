// oxlint-disable typescript/no-explicit-any no-unused-vars - This type of validation requires actual any

import { decodeJwt } from 'jose'

import type {
    FhirDocumentReference,
    FhirEncounter,
    FhirOrganization,
    FhirPatient,
    FhirPractitioner,
    FhirQuestionnaireResponse,
} from '../../zod'
import { logger } from '../smart/lib/logger'
import { IdTokenSchema, type TokenRefreshResponse, type TokenResponse } from '../smart/token/token-schema'
import type { SmartConfiguration } from '../smart/well-known/smart-configuration-schema'

import { now } from './utils'
import { activeValidations, type Validation, type ValidationType } from './validations'
import { ValidatorBuilder } from './ValidatorBuilder'

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

        try {
            outcomes
                .whenValueExists(sc.grant_types_supported, 'grant_types_supported', 'required')
                .thenCheck<string[]>({
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
        } catch (e) {
            logger.warn(new Error('SMART_CONFIGURATION validation failed, ignoring', { cause: e }))
        }
    }

    tokenResponse(tr: TokenResponse & Loosely): void {
        const outcomes = new ValidatorBuilder('TOKEN_RESPONSE')

        try {
            outcomes.check({
                test: tr['practitioner'] != null,
                yeah: { type: 'WARN', message: 'practitioner should not be part of the token response' },
            })

            this.update(outcomes)

            /**
             * Token response has id_token, we'll chain it automatically
             */
            this.idToken(tr.id_token)
        } catch (e) {
            logger.warn(new Error('TOKEN_RESPONSE validation failed, ignoring', { cause: e }))
        }
    }

    tokenRefreshResponse(tr: TokenRefreshResponse & Loosely): void {
        const outcomes = new ValidatorBuilder('TOKEN_REFRESH_RESPONSE')

        try {
            outcomes.check({
                test: tr['encounter'] != null,
                yeah: { type: 'WARN', message: 'encounter should not be part of the token refresh response' },
            })

            outcomes.check({
                test: tr['patient'] != null,
                yeah: { type: 'WARN', message: 'patient should not be part of the token refresh response' },
            })

            outcomes.check({
                test: tr['practitioner'] != null,
                yeah: { type: 'WARN', message: 'practitioner should not be part of the token refresh response' },
            })

            this.update(outcomes)
        } catch (e) {
            logger.warn(new Error('TOKEN_REFRESH_RESPONSE validation failed, ignoring', { cause: e }))
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
        } catch (e) {
            logger.warn(new Error('ID_TOKEN validation failed, ignoring', { cause: e }))
        }
    }

    encounter(encounter: FhirEncounter & Loosely): void {
        const outcomes = new ValidatorBuilder('ENCOUNTER')

        try {
            // Subject is used to identify the patient for the consultation.
            outcomes.whenValueExists(encounter.subject, 'subject', 'required').thenCheck<{ reference?: string }>({
                test: (value) => value.reference != null,
                yeah: { type: 'INFO', message: 'subject reference present in encounter' },
                nah: { type: 'ERROR', message: 'subject is missing a reference' },
            })

            // Participant/individual is used to identify the practitioner (sykmelder) for the consultation.
            outcomes
                .whenValueExists(encounter.participant, 'participant', 'required')
                .thenCheck<{ individual?: { reference?: string } }[]>({
                    test: (value) => value.some((p) => p.individual?.reference != null),
                    yeah: { type: 'INFO', message: 'participant individual reference present in encounter' },
                    nah: { type: 'ERROR', message: 'participant is missing an individual reference' },
                })

            // ServiceProvider is used to identify the practitioner's organization for the consultation.
            outcomes
                .whenValueExists(encounter.serviceProvider, 'serviceProvider', 'required')
                .thenCheck<{ reference?: string }>({
                    test: (value) => value.reference != null,
                    yeah: { type: 'INFO', message: 'serviceProvider reference present in encounter' },
                    nah: { type: 'ERROR', message: 'serviceProvider is missing a reference' },
                })

            // Diagnosis is used to pre-fill the diagnosis in the app, but is explicitly not required.
            outcomes.check({
                test: encounter.diagnosis == null || encounter.diagnosis.length === 0,
                yeah: { type: 'WARN', message: 'no diagnosis list present in encounter' },
                nah: { type: 'INFO', message: `diagnosis list (${encounter.diagnosis?.length}) present in encounter` },
            })

            // Type/coding kontakttype is used to determine physical (1) or phone/video (6 | 7) consultation.
            // Not present in the FhirEncounter schema, so read loosely.
            const kontakttypeSystem = 'urn:oid:2.16.578.1.12.4.1.1.8432'
            const hasKontakttype =
                Array.isArray(encounter.type) &&
                encounter.type.some(
                    (t: any) => Array.isArray(t?.coding) && t.coding.some((c: any) => c?.system === kontakttypeSystem),
                )
            outcomes.check({
                test: hasKontakttype,
                yeah: { type: 'INFO', message: 'type kontakttype coding present in encounter' },
                nah: { type: 'WARN', message: 'no type kontakttype coding present in encounter' },
            })

            this.update(outcomes)
        } catch (e) {
            logger.warn(new Error('ENCOUNTER validation failed, ignoring', { cause: e }))
        }
    }

    practitioner(practitioner: FhirPractitioner & Loosely): void {}

    patient(patient: FhirPatient & Loosely): void {}

    organization(organization: FhirOrganization & Loosely): void {}

    documentReference(dr: FhirDocumentReference & Loosely): void {}

    questionnaireResponse(qr: FhirQuestionnaireResponse & Loosely): void {}

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

export type Loosely = {
    [key: string]: any
}
