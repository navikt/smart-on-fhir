/* eslint-disable @typescript-eslint/explicit-function-return-type */

import * as z from 'zod'

import { FhirDocumentReferenceSchema } from './document-reference'
import { FhirQuestionnaireResponseSchema } from './questionnare-response'

export type FhirSearchsetBundle<Resource> = z.infer<ReturnType<typeof createFhirSeachSetBundleSchema<Resource>>>
export function createFhirSeachSetBundleSchema<T>(ResourceSchema: z.ZodType<T>) {
    return z.object({
        resourceType: z.literal('Bundle'),
        type: z.literal('searchset'),
        entry: z
            .array(
                z.object({
                    resource: ResourceSchema,
                }),
            )
            .optional(),
    })
}

export type FhirBatchBundle = z.infer<typeof FhirBatchBundleSchema>
export const FhirBatchBundleSchema = z.object({
    resourceType: z.literal('Bundle'),
    type: z.union([z.literal('batch')]),
    entry: z.array(
        z.object({
            method: z.union([z.literal('POST'), z.literal('PUT')]),
            url: z.string(),
            resource: z.union([FhirDocumentReferenceSchema.partial(), FhirQuestionnaireResponseSchema.partial()]),
        }),
    ),
})

export type FhirBatchResponseBundle = z.infer<typeof FhirBatchResponseBundleSchema>
export const FhirBatchResponseBundleSchema = z.object({
    resourceType: z.literal('Bundle'),
    type: z.union([z.literal('batch-response')]),
    entry: z.array(
        z.object({
            response: z.object({
                status: z.string(),
                location: z.string().optional(),
                etag: z.string().optional(),
                lastModified: z.string().optional(),
            }),
        }),
    ),
})
