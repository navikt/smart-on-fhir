import * as z from 'zod'

import { NameSchema } from '../zod'

const TelecomSystemSchema = z.enum(['phone', 'fax', 'email', 'pager', 'url', 'sms', 'other'])
const ContactPointSchema = z.object({
    system: TelecomSystemSchema,
    value: z.string(),
    use: z.enum(['home', 'work', 'temp', 'old', 'mobile']).optional(),
})

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
    id: z.string(),
    meta: z.object({ profile: z.array(z.string()).optional() }).optional(),
    name: NameSchema,
    identifier: z.array(z.object({ system: z.string(), value: z.string() })),
    telecom: z.array(ContactPointSchema).optional(),
    qualification: z.array(FhirPractitionerQualificationSchema).optional(),
})
