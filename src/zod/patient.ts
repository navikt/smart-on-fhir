import * as z from 'zod/v4'

import { GeneralIdentifierSchema, NameSchema } from './common'

export type FhirPatient = z.infer<typeof FhirPatientSchema>
export const FhirPatientSchema = z
    .object({
        resourceType: z.literal('Patient'),
        identifier: z.array(GeneralIdentifierSchema).optional(),
        name: NameSchema,
        generalPractitioner: z.array(z.object({ identifier: GeneralIdentifierSchema, display: z.string() })).optional(),
    })
    .loose()
