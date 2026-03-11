import type * as z from 'zod'

import {
    type FhirDocumentReference,
    FhirDocumentReferenceBaseSchema,
    type FhirQuestionaireResponse,
    FhirQuestionnaireResponseSchema,
} from '../../../zod'

/**
 * A map of FHIR paths in a FHIR server and their known corresponding resource types.
 */
type CreateMap = {
    DocumentReference: FhirDocumentReference
    QuestionnaireResponse: FhirQuestionaireResponse
}

type PayloadMap = {
    DocumentReference: Partial<FhirDocumentReference>
    QuestionnaireResponse: Partial<FhirQuestionaireResponse>
}

/**
 * All known paths based on keys of creatable resources
 */
export type KnownCreatePaths = keyof CreateMap

/**
 * Looks up the correct FHIR type for a given path.
 */
export type ResponseForCreate<T extends string> = {
    [K in keyof CreateMap]: T extends `${K}${string}` ? CreateMap[K] : never
}[keyof CreateMap]

/**
 * Looks up the correct payload type for a given path.
 */
export type PayloadForCreate<T extends string> = {
    [K in keyof PayloadMap]: T extends `${K}${string}` ? PayloadMap[K] : never
}[keyof PayloadMap]

/**
 * Converts from a KnownCreatePaths to the actual FHIR zod schema for this resource.
 *
 * This function is a type-hole, the callee will have to as the resulting parsed schema to the correct type.
 */
export function createResourceToSchema(resource: KnownCreatePaths): z.ZodObject {
    switch (resource) {
        case 'DocumentReference':
            return FhirDocumentReferenceBaseSchema
        case 'QuestionnaireResponse':
            return FhirQuestionnaireResponseSchema
        default:
            throw new Error(`Unknown resource type (or not implemented): ${resource}`)
    }
}
