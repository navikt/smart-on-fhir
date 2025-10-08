import * as z from 'zod'

import { GeneralIdentifierSchema } from './common'

const TelecomSystemSchema = z.enum(['phone', 'email'], {
    error: (issue) => {
        return issue.input == null
            ? 'Telecom system is required'
            : `Telecom system must be either phone or email, was ${issue.input}`
    },
})

export type FhirOrganization = z.infer<typeof FhirOrganizationSchema>
export const FhirOrganizationSchema = z.object({
    resourceType: z.literal('Organization'),
    id: z.string(),
    identifier: z.array(GeneralIdentifierSchema),
    name: z.string(),
    telecom: z.array(z.object({ system: TelecomSystemSchema, value: z.string() })),
})
