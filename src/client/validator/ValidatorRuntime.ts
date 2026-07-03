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

    private update(validation: ValidatorBuilder): void {
        const result = validation.toValidation()
        this.validations[result.type] = result
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

            this.update(outcomes)
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

    practitioner(practitioner: FhirPractitioner & Loosely): void {
        const outcomes = new ValidatorBuilder('PRACTITIONER')

        try {
            // Identifier/hpr-nummer is used as the identifier for the practitioner (sykmelder).
            const hprSystem = 'urn:oid:2.16.578.1.12.4.1.4.4'
            outcomes
                .whenValueExists(practitioner.identifier, 'identifier', 'required')
                .thenCheck<{ system?: string; value?: string }[]>({
                    test: (value) => value.some((i) => i.system === hprSystem && !!i.value),
                    yeah: { type: 'INFO', message: 'hpr-nummer identifier present in practitioner' },
                    nah: { type: 'ERROR', message: `hpr-nummer identifier (${hprSystem}) is missing in practitioner` },
                })

            this.update(outcomes)
        } catch (e) {
            logger.warn(new Error('PRACTITIONER validation failed, ignoring', { cause: e }))
        }
    }

    patient(patient: FhirPatient & Loosely): void {
        const outcomes = new ValidatorBuilder('PATIENT')

        try {
            // Identifier/fødselsnummer or d-nummer is necessary to identify the patient.
            const fnrSystem = 'urn:oid:2.16.578.1.12.4.1.4.1'
            const dnrSystem = 'urn:oid:2.16.578.1.12.4.1.4.2'
            outcomes
                .whenValueExists(patient.identifier, 'identifier', 'required')
                .thenCheck<{ system?: string; value?: string }[]>({
                    test: (value) => value.some((i) => (i.system === fnrSystem || i.system === dnrSystem) && !!i.value),
                    yeah: { type: 'INFO', message: 'fødselsnummer or d-nummer identifier present in patient' },
                    nah: {
                        type: 'ERROR',
                        message: `fødselsnummer (${fnrSystem}) or d-nummer (${dnrSystem}) identifier is missing in patient`,
                    },
                })

            // Name is shown in the app so the practitioner can confirm the correct patient.
            outcomes.whenValueExists(patient.name, 'name', 'required').thenCheck<{ family?: string }[]>({
                test: (value) => value.some((n) => !!n.family),
                yeah: { type: 'INFO', message: 'name present in patient' },
                nah: { type: 'ERROR', message: 'name is missing in patient' },
            })

            this.update(outcomes)
        } catch (e) {
            logger.warn(new Error('PATIENT validation failed, ignoring', { cause: e }))
        }
    }

    organization(organization: FhirOrganization & Loosely): void {
        const outcomes = new ValidatorBuilder('ORGANIZATION')

        try {
            // Identifier/organisasjonsnummer (ENH) is used as the identifier for the organization
            // the practitioner is affiliated with (e.g. fastlegekontor).
            const enhSystem = 'urn:oid:2.16.578.1.12.4.1.4.101'
            outcomes
                .whenValueExists(organization.identifier, 'identifier', 'required')
                .thenCheck<{ system?: string; value?: string }[]>({
                    test: (value) => value.some((i) => i.system === enhSystem && !!i.value),
                    yeah: { type: 'INFO', message: 'organisasjonsnummer identifier present in organization' },
                    nah: {
                        type: 'ERROR',
                        message: `organisasjonsnummer (${enhSystem}) identifier is missing in organization`,
                    },
                })

            // Telecom/phone is used by Nav caseworkers to contact the practitioner during follow-up.
            outcomes
                .whenValueExists(organization.telecom, 'telecom', 'required')
                .thenCheck<{ system?: string; value?: string }[]>({
                    test: (value) => value.some((t) => t.system === 'phone' && !!t.value),
                    yeah: { type: 'INFO', message: 'phone telecom present in organization' },
                    nah: { type: 'ERROR', message: 'phone telecom is missing in organization' },
                })

            this.update(outcomes)
        } catch (e) {
            logger.warn(new Error('ORGANIZATION validation failed, ignoring', { cause: e }))
        }
    }

    documentReference(dr: FhirDocumentReference & Loosely): void {
        const outcomes = new ValidatorBuilder('DOCUMENT_REFERENCE')

        try {
            // Context/Encounter MUST contain a reference to the consultation, as Folketrygdloven §8-7
            // requires a consultation for a sykmelding.
            outcomes
                .whenValueExists(dr.context?.encounter, 'context.encounter', 'required')
                .thenCheck<{ reference?: string }[]>({
                    test: (value) => value.some((e) => !!e.reference),
                    yeah: { type: 'INFO', message: 'context.encounter reference present in documentReference' },
                    nah: { type: 'ERROR', message: 'context.encounter reference is missing in documentReference' },
                })

            // Type specifies the document type. For sykmelding all documents are code J01-2 in the
            // 9602 (Dokumenttyper) code system from Helsedirektoratet.
            const dokumenttypeSystem = 'urn:oid:2.16.578.1.12.4.1.1.9602'
            const sykmeldingCode = 'J01-2'
            outcomes
                .whenValueExists(dr.type?.coding, 'type.coding', 'required')
                .thenCheck<{ system?: string; code?: string }[]>({
                    test: (value) => value.some((c) => c.system === dokumenttypeSystem && c.code === sykmeldingCode),
                    yeah: { type: 'INFO', message: 'type coding J01-2 present in documentReference' },
                    nah: {
                        type: 'ERROR',
                        message: `type coding J01-2 (${dokumenttypeSystem}) is missing in documentReference`,
                    },
                })

            // Subject is a reference to the patient the sykmelding is for.
            outcomes.whenValueExists(dr.subject, 'subject', 'required').thenCheck<{ reference?: string }>({
                test: (value) => !!value.reference,
                yeah: { type: 'INFO', message: 'subject reference present in documentReference' },
                nah: { type: 'ERROR', message: 'subject reference is missing in documentReference' },
            })

            // Author is a reference to the Practitioner who submitted the sykmelding.
            outcomes.whenValueExists(dr.author, 'author', 'required').thenCheck<{ reference?: string }[]>({
                test: (value) => value.some((a) => !!a.reference),
                yeah: { type: 'INFO', message: 'author reference present in documentReference' },
                nah: { type: 'ERROR', message: 'author reference is missing in documentReference' },
            })

            // Content is the document itself, a base64-encoded PDF for sykmeldinger.
            outcomes
                .whenValueExists(dr.content, 'content', 'required')
                .thenCheck<{ attachment?: { data?: string } }[]>({
                    test: (value) => value.some((c) => !!c.attachment?.data),
                    yeah: { type: 'INFO', message: 'content attachment data present in documentReference' },
                    nah: { type: 'ERROR', message: 'content attachment data is missing in documentReference' },
                })

            // Description is a human-readable description of the document, generated by Nav.
            outcomes.check({
                test: dr.description != null && dr.description !== '',
                yeah: { type: 'INFO', message: 'description present in documentReference' },
                nah: { type: 'WARN', message: 'no description present in documentReference' },
            })

            this.update(outcomes)
        } catch (e) {
            logger.warn(new Error('DOCUMENT_REFERENCE validation failed, ignoring', { cause: e }))
        }
    }

    questionnaireResponse(qr: FhirQuestionnaireResponse & Loosely): void {
        const outcomes = new ValidatorBuilder('QUESTIONNAIRE_RESPONSE')

        try {
            // Questionnaire references the publicly published Questionnaire definition via canonical URL,
            // so the EHR can look up the structure of the item fields.
            const canonicalQuestionnaire = 'https://www.nav.no/samarbeidspartner/sykmelding/fhir/R4/Questionnaire/V1'
            outcomes.whenValueExists(qr.questionnaire, 'questionnaire', 'required').thenCheck<string>({
                test: (value) => value === canonicalQuestionnaire,
                yeah: { type: 'INFO', message: 'questionnaire references the canonical Nav Questionnaire' },
                nah: { type: 'ERROR', message: `questionnaire should reference ${canonicalQuestionnaire}` },
            })

            // Subject is a reference to the patient the sykmelding is for.
            outcomes.whenValueExists(qr.subject, 'subject', 'required').thenCheck<{ reference?: string }>({
                test: (value) => !!value.reference,
                yeah: { type: 'INFO', message: 'subject reference present in questionnaireResponse' },
                nah: { type: 'ERROR', message: 'subject reference is missing in questionnaireResponse' },
            })

            // Encounter ties the response to the active consultation.
            outcomes.whenValueExists(qr.encounter, 'encounter', 'required').thenCheck<{ reference?: string }>({
                test: (value) => !!value.reference,
                yeah: { type: 'INFO', message: 'encounter reference present in questionnaireResponse' },
                nah: { type: 'ERROR', message: 'encounter reference is missing in questionnaireResponse' },
            })

            // Author is a reference to the sykmelder who filled out the sykmelding.
            outcomes.whenValueExists(qr.author, 'author', 'required').thenCheck<{ reference?: string }>({
                test: (value) => !!value.reference,
                yeah: { type: 'INFO', message: 'author reference present in questionnaireResponse' },
                nah: { type: 'ERROR', message: 'author reference is missing in questionnaireResponse' },
            })

            this.update(outcomes)
        } catch (e) {
            logger.warn(new Error('QUESTIONNAIRE_RESPONSE validation failed, ignoring', { cause: e }))
        }
    }

    report(): Validation[] {
        return Object.values(this.validations)
    }

    export(): string {
        return JSON.stringify(this.validations)
    }

    restore(persisted: string | undefined | null): void {
        // Nothing to restore
        if (persisted == null) return

        const parsed = JSON.parse(persisted)
        if (typeof parsed !== 'object' || Object.keys(parsed).length !== activeValidations.length) {
            logger.warn('Invalid persisted validator runtime state, ignoring')
            return
        }

        const state = parsed as Record<ValidationType, Validation>
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
}

export type Loosely = {
    [key: string]: any
}
