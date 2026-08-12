import * as z from 'zod'

import { GeneralIdentifierSchema } from './common'

const TelecomSystemSchema = z.enum(['phone', 'fax', 'email', 'pager', 'url', 'sms', 'other'], {
    error: (issue) => {
        return issue.input == null
            ? 'Telecom system is required'
            : `Telecom system must be either phone or email, was ${typeof issue.input === 'string' ? issue.input : JSON.stringify(issue.input)}`
    },
})

/**
 * TODO add/change:
 * - "meta": {
 *   "profile": ["http://hl7.no/fhir/StructureDefinition/no-basis-Organization"]
 * }
 * and make it optional
 */
export type FhirOrganization = z.infer<typeof FhirOrganizationSchema>
export const FhirOrganizationSchema = z.object({
    resourceType: z.literal('Organization'),
    id: z.string(),
    identifier: z.array(GeneralIdentifierSchema),
    name: z.string().nullish(),
    telecom: z.array(z.object({ system: TelecomSystemSchema, value: z.string() })),
})
