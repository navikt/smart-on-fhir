import * as z from 'zod'

export type OperationOutcome = z.infer<typeof OperationOutcomeSchema>
export const OperationOutcomeSchema = z
    .object({
        resourceType: z.literal('OperationOutcome'),
        issue: z.array(
            z.object({
                severity: z.enum(['fatal', 'error', 'warning', 'information']),
                code: z.string(),
                diagnostics: z.string().optional(),
            }),
        ),
    })
    .loose()
