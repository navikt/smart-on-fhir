import type { Validation } from '#internal-validator/validations'

export const fhirResourcesValidation = [
    'ENCOUNTER',
    'PRACTITIONER',
    'PATIENT',
    'ORGANIZATION',
    'DOCUMENT_REFERENCE',
    'QUESTIONNAIRE_RESPONSE',
] as const

export type FhirValidationType = (typeof fhirResourcesValidation)[number]

export type FhirValidation = Validation<FhirValidationType>
