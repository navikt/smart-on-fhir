import * as z from 'zod'

export type TokenResponse = z.infer<typeof TokenResponseSchema>
export const TokenResponseSchema = z.object({
    // OIDC:
    access_token: z.string(),
    id_token: z.string(),
    refresh_token: z.string(),
    // SMART:
    patient: z.string(),
    encounter: z.string(),
    //webmed fix
    practitioner: z.string().optional(),
})

export type TokenRefreshResponse = z.infer<typeof TokenRefreshResponseSchema>
export const TokenRefreshResponseSchema = z.object({
    // OIDC:
    access_token: z.string(),
    id_token: z.string(),
    refresh_token: z.string(),
})

export type IdToken = z.infer<typeof IdTokenSchema>
export const IdTokenSchema = z.object({
    // SMART:
    fhirUser: z.string().optional(), // TODO: Opitonalness is part of webmed hack
})
