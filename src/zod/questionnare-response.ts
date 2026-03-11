import * as z from 'zod'

type QuestionnaireResponseAnswer = z.infer<typeof QuestionnaireResponseAnswerSchema>
const QuestionnaireResponseAnswerSchema = z.object({
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

type QuestionnaireResponseItem = z.infer<typeof QuestionnaireResponseItemSchema>
const QuestionnaireResponseItemSchema = z.object({
    linkId: z.string(),
    text: z.string(),
    answer: z.array(QuestionnaireResponseAnswerSchema).optional(),
    get item() {
        return z.array(QuestionnaireResponseItemSchema).optional()
    },
})

export type QuestionaireResponse = z.infer<typeof QuestionnaireResponseSchema>
const QuestionnaireResponseSchema = z.object({
    resourceType: z.literal('QuestionnaireResponse'),
    id: z.string(),
    status: z.literal('completed'),
    item: z.array(QuestionnaireResponseItemSchema),
})
