import { fhirResourcesValidation } from '../../fhir/validation/fhir-validators'
import type { Validation } from '../../internal/validator/validations'

export const allSmartValidations = [
    'SMART_CONFIGURATION',
    'TOKEN_RESPONSE',
    'TOKEN_REFRESH_RESPONSE',
    'ID_TOKEN',
    ...fhirResourcesValidation,
] as const

export type SmartValidationType = (typeof allSmartValidations)[number]

export type SmartValidation = Validation<SmartValidationType>
