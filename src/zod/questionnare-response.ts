import * as z from 'zod'

export type FhirQuestionnaireResponseAnswer = z.infer<typeof FhirQuestionnaireResponseAnswerSchema>
export const FhirQuestionnaireResponseAnswerSchema = z.object({
    valueString: z.string().optional(),
    valueInteger: z.number().int().optional(),
    valueBoolean: z.boolean().optional(),
    valueDecimal: z.number().optional(),
    valueDate: z.string().optional(),
    valueDateTime: z.string().optional(),
    valueTime: z.string().optional(),
    valueCoding: z
        .object({
            system: z.string().optional(),
            code: z.string().optional(),
            display: z.string().optional(),
        })
        .optional(),
})

export type FhirQuestionnaireResponseItem = z.infer<typeof FhirQuestionnaireResponseItemSchema>
export const FhirQuestionnaireResponseItemSchema = z.object({
    linkId: z.string(),
    text: z.string(),
    answer: z.array(FhirQuestionnaireResponseAnswerSchema).optional(),
    get item() {
        return z.array(FhirQuestionnaireResponseItemSchema).optional()
    },
})

export type FhirQuestionaireResponse = z.infer<typeof FhirQuestionnaireResponseSchema>
export const FhirQuestionnaireResponseSchema = z.object({
    resourceType: z.literal('QuestionnaireResponse'),
    id: z.string(),
    status: z.literal('completed'),
    item: z.array(FhirQuestionnaireResponseItemSchema),
    subject: z.object({ reference: z.string() }).optional(),
    author: z.object({ reference: z.string() }).optional(),
    encounter: z.object({ reference: z.string() }).optional(),
})
