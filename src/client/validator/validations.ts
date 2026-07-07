export const activeValidations = [
    'SMART_CONFIGURATION',
    'TOKEN_RESPONSE',
    'TOKEN_REFRESH_RESPONSE',
    'ID_TOKEN',
    'ENCOUNTER',
    'PRACTITIONER',
    'PATIENT',
    'ORGANIZATION',
    'DOCUMENT_REFERENCE',
    'QUESTIONNAIRE_RESPONSE',
] as const

export type ValidationType = (typeof activeValidations)[number]

export type ValidationLevel = 'OK' | 'WARNING' | 'ERROR'

export type ValidationTest = { type: ValidationLevel; message: string }

export type ValidationOutcome = {
    status: ValidationLevel
    tests: ValidationTest[]
}

type ValidationUnvalidated = {
    status: 'UNVALIDATED'
}

export type Validation = {
    type: ValidationType
    at: string
} & (ValidationUnvalidated | ValidationOutcome)
