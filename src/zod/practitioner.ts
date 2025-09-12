import * as z from 'zod'

import { NameSchema } from '../zod'

export type FhirPractitionerQualification = z.infer<typeof FhirPractitionerQualificationSchema>
const FhirPractitionerQualificationSchema = z.object({
    code: z.object({
        coding: z.array(
            z.object({
                system: z.string(),
                code: z.string(),
                display: z.string(),
            }),
        ),
    }),
    period: z.object({ start: z.string() }).optional(),
})

export type FhirPractitioner = z.infer<typeof FhirPractitionerSchema>
export const FhirPractitionerSchema = z.object({
    resourceType: z.literal('Practitioner'),
    meta: z.object({ profile: z.array(z.string()) }).optional(),
    name: NameSchema,
    identifier: z.array(z.object({ system: z.string(), value: z.string() })),
    qualification: z.array(FhirPractitionerQualificationSchema).optional(),
})
