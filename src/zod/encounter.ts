import * as z from 'zod'

import { CobeableConceptSchema, ReferenceSchema } from './common'

export type FhirEncounterDiagnosis = z.infer<typeof FhirEncounterDiagnosisSchema>
export const FhirEncounterDiagnosisSchema = z.object({
    condition: ReferenceSchema,
    rank: z.number().optional(),
})

/**
 * TODO add/change:
 * - "class": {
 *   "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
 *   "code": "AMB (physical) | VR (virtual)
 * }
 *
 * This is required. When that is done update syk-inn/docs/fhir/encounter.md
 */
export type FhirEncounter = z.infer<typeof FhirEncounterSchema>
export const FhirEncounterSchema = z.object({
    resourceType: z.literal('Encounter'),
    id: z.string(),
    status: z.string(),
    diagnosis: z.array(FhirEncounterDiagnosisSchema).optional(),
    reasonCode: z
        .array(
            z.object({
                coding: z.array(CobeableConceptSchema),
            }),
        )
        .optional(),
    subject: ReferenceSchema.optional(),
    participant: z.array(z.object({ individual: ReferenceSchema })).optional(),
    serviceProvider: ReferenceSchema,
})
