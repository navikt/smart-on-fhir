// oxlint-disable typescript/no-explicit-any no-unused-vars - This type of validation requires actual any

import { BaseValidator } from '../../internal/validator/base-validator'
import { now } from '../../internal/validator/utils'
import type { Loosely, Validations } from '../../internal/validator/validations'
import { ValidatorBuilder } from '../../internal/validator/validator-builder'
import type {
    FhirDocumentReference,
    FhirEncounter,
    FhirOrganization,
    FhirPatient,
    FhirPractitioner,
    FhirQuestionnaireResponse,
} from '../../zod'
import { fhirLogger } from '../fhir-logger'

import { fhirResourcesValidation, type FhirValidation, type FhirValidationType } from './fhir-validators'

/**
 * These validations are not restoreable like SmartValidationRuntime, this is because the standalone
 * FHIR-client is typically either used directly statless, or through an existing ReadyClient with
 * its own session.
 */
export class FhirValidatorRuntime extends BaseValidator<FhirValidationType> {
    constructor(validations?: Validations<FhirValidationType>) {
        if (validations) {
            super(validations)
            return
        }

        const initial = Object.fromEntries(
            fhirResourcesValidation.map(
                (type) => [type, { type, at: now(), status: 'UNVALIDATED' } satisfies FhirValidation] as const,
            ),
        ) as Validations<FhirValidationType>

        super(initial)
    }

    encounter(encounter: FhirEncounter & Loosely): void {
        const outcomes = new ValidatorBuilder('ENCOUNTER')

        try {
            // Subject is used to identify the patient for the consultation.
            outcomes.whenValueExists(encounter.subject, 'subject', 'required').thenCheck<{ reference?: string }>({
                test: (value) => value.reference != null,
                yeah: { type: 'OK', message: 'subject reference present in encounter' },
                nah: { type: 'ERROR', message: 'subject is missing a reference' },
            })

            // Participant/individual is used to identify the practitioner (sykmelder) for the consultation.
            outcomes
                .whenValueExists(encounter.participant, 'participant', 'required')
                .thenCheck<{ individual?: { reference?: string } }[]>({
                    test: (value) => value.some((p) => p.individual?.reference != null),
                    yeah: { type: 'OK', message: 'participant individual reference present in encounter' },
                    nah: { type: 'ERROR', message: 'participant is missing an individual reference' },
                })

            // ServiceProvider is used to identify the practitioner's organization for the consultation.
            outcomes
                .whenValueExists(encounter.serviceProvider, 'serviceProvider', 'required')
                .thenCheck<{ reference?: string }>({
                    test: (value) => value.reference != null,
                    yeah: { type: 'OK', message: 'serviceProvider reference present in encounter' },
                    nah: { type: 'ERROR', message: 'serviceProvider is missing a reference' },
                })

            // Diagnosis is used to pre-fill the diagnosis in the app, but is explicitly not required.
            outcomes.check({
                test: encounter.diagnosis == null || encounter.diagnosis.length === 0,
                yeah: { type: 'WARNING', message: 'no diagnosis list present in encounter' },
                nah: { type: 'OK', message: `diagnosis list (${encounter.diagnosis?.length}) present in encounter` },
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
                yeah: { type: 'OK', message: 'type kontakttype coding present in encounter' },
                nah: { type: 'WARNING', message: 'no type kontakttype coding present in encounter' },
            })

            this.update(outcomes)
        } catch (e) {
            fhirLogger.warn(new Error('ENCOUNTER validation failed, ignoring', { cause: e }))
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
                    yeah: { type: 'OK', message: 'hpr-nummer identifier present in practitioner' },
                    nah: { type: 'ERROR', message: `hpr-nummer identifier (${hprSystem}) is missing in practitioner` },
                })

            this.update(outcomes)
        } catch (e) {
            fhirLogger.warn(new Error('PRACTITIONER validation failed, ignoring', { cause: e }))
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
                    yeah: { type: 'OK', message: 'fødselsnummer or d-nummer identifier present in patient' },
                    nah: {
                        type: 'ERROR',
                        message: `fødselsnummer (${fnrSystem}) or d-nummer (${dnrSystem}) identifier is missing in patient`,
                    },
                })

            // Name is shown in the app so the practitioner can confirm the correct patient.
            outcomes.whenValueExists(patient.name, 'name', 'required').thenCheck<{ family?: string }[]>({
                test: (value) => value.some((n) => !!n.family),
                yeah: { type: 'OK', message: 'name present in patient' },
                nah: { type: 'ERROR', message: 'name is missing in patient' },
            })

            this.update(outcomes)
        } catch (e) {
            fhirLogger.warn(new Error('PATIENT validation failed, ignoring', { cause: e }))
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
                    yeah: { type: 'OK', message: 'organisasjonsnummer identifier present in organization' },
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
                    yeah: { type: 'OK', message: 'phone telecom present in organization' },
                    nah: { type: 'ERROR', message: 'phone telecom is missing in organization' },
                })

            this.update(outcomes)
        } catch (e) {
            fhirLogger.warn(new Error('ORGANIZATION validation failed, ignoring', { cause: e }))
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
                    yeah: { type: 'OK', message: 'context.encounter reference present in documentReference' },
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
                    yeah: { type: 'OK', message: 'type coding J01-2 present in documentReference' },
                    nah: {
                        type: 'ERROR',
                        message: `type coding J01-2 (${dokumenttypeSystem}) is missing in documentReference`,
                    },
                })

            // Subject is a reference to the patient the sykmelding is for.
            outcomes.whenValueExists(dr.subject, 'subject', 'required').thenCheck<{ reference?: string }>({
                test: (value) => !!value.reference,
                yeah: { type: 'OK', message: 'subject reference present in documentReference' },
                nah: { type: 'ERROR', message: 'subject reference is missing in documentReference' },
            })

            // Author is a reference to the Practitioner who submitted the sykmelding.
            outcomes.whenValueExists(dr.author, 'author', 'required').thenCheck<{ reference?: string }[]>({
                test: (value) => value.some((a) => !!a.reference),
                yeah: { type: 'OK', message: 'author reference present in documentReference' },
                nah: { type: 'ERROR', message: 'author reference is missing in documentReference' },
            })

            // Content is the document itself, should have at least one attachment, could be binary ref or base64
            outcomes
                .whenValueExists(dr.content, 'content', 'required')
                .thenCheck<{ attachment?: { data?: string } }[]>({
                    test: (value) => value.some((c) => c.attachment != null),
                    yeah: { type: 'OK', message: 'content attachment present in documentReference' },
                    nah: { type: 'ERROR', message: 'content attachment is missing in documentReference' },
                })

            // Description is a human-readable description of the document, generated by Nav.
            outcomes.check({
                test: dr.description != null && dr.description !== '',
                yeah: { type: 'OK', message: 'description present in documentReference' },
                nah: { type: 'WARNING', message: 'no description present in documentReference' },
            })

            this.update(outcomes)
        } catch (e) {
            fhirLogger.warn(new Error('DOCUMENT_REFERENCE validation failed, ignoring', { cause: e }))
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
                yeah: { type: 'OK', message: 'questionnaire references the canonical Nav Questionnaire' },
                nah: { type: 'ERROR', message: `questionnaire should reference ${canonicalQuestionnaire}` },
            })

            // Subject is a reference to the patient the sykmelding is for.
            outcomes.whenValueExists(qr.subject, 'subject', 'required').thenCheck<{ reference?: string }>({
                test: (value) => !!value.reference,
                yeah: { type: 'OK', message: 'subject reference present in questionnaireResponse' },
                nah: { type: 'ERROR', message: 'subject reference is missing in questionnaireResponse' },
            })

            // Encounter ties the response to the active consultation.
            outcomes.whenValueExists(qr.encounter, 'encounter', 'required').thenCheck<{ reference?: string }>({
                test: (value) => !!value.reference,
                yeah: { type: 'OK', message: 'encounter reference present in questionnaireResponse' },
                nah: { type: 'ERROR', message: 'encounter reference is missing in questionnaireResponse' },
            })

            // Author is a reference to the sykmelder who filled out the sykmelding.
            outcomes.whenValueExists(qr.author, 'author', 'required').thenCheck<{ reference?: string }>({
                test: (value) => !!value.reference,
                yeah: { type: 'OK', message: 'author reference present in questionnaireResponse' },
                nah: { type: 'ERROR', message: 'author reference is missing in questionnaireResponse' },
            })

            this.update(outcomes)
        } catch (e) {
            fhirLogger.warn(new Error('QUESTIONNAIRE_RESPONSE validation failed, ignoring', { cause: e }))
        }
    }
}
