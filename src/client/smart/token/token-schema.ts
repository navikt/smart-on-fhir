import * as z from 'zod'

const FhirId = z.string().regex(/^[A-Za-z0-9\-.]{1,64}$/, {
    error: 'Invalid FHIR id: must be 1-64 characters of ASCII letters, digits, "-" or "."',
})

export type TokenResponse = z.infer<typeof TokenResponseSchema>
export const TokenResponseSchema = z.object({
    // OIDC:
    access_token: z.string(),
    id_token: z.string(),
    refresh_token: z.string(),
    // SMART:
    patient: FhirId,
    encounter: FhirId,
})

export type TokenRefreshResponse = z.infer<typeof TokenRefreshResponseSchema>
export const TokenRefreshResponseSchema = z.object({
    // OIDC:
    access_token: z.string(),
    refresh_token: z.string(),
})

export type IdToken = z.infer<typeof IdTokenSchema>
export const IdTokenSchema = z
    .object({
        // SMART:
        fhirUser: z.string(),
    })
    .catchall(z.unknown())
