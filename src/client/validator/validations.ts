export const activeValidations = [
    'SMART_CONFIGURATION',
    'TOKEN_RESPONSE',
    'ACCESS_TOKEN',
    'ID_TOKEN',
    'ENCOUNTER',
    'PRACTITIONER',
    'PATIENT',
    'ORGANIZATION',
    'DOCUMENT_REFERENCE',
    'QUESTIONNAIRE_RESPONSE',
] as const

export type ValidationType = (typeof activeValidations)[number]

export type ValidationOverallOutcome = 'GOOD' | 'PASS' | 'FAIL'
export type ValidationTestLevel = 'INFO' | 'WARN' | 'ERROR'
export type ValidationTest = { type: ValidationTestLevel; message: string }

export type Validation = {
    type: ValidationType
    at: string
} & (
    | { status: 'UNVALIDATED' }
    | {
          status: ValidationOverallOutcome
          tests: ValidationTest[]
      }
)
