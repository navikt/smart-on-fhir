import { decodeJwt } from 'jose'
import * as z from 'zod'

import { type IdToken, IdTokenSchema } from '../smart/token/token-schema'

export type InitialSession = z.infer<typeof InitialSessionSchema>
export const InitialSessionSchema = z.object({
    /**
     * The actual FHIR server the app was launched from as the "iss" query parameter.
     */
    fhirServer: z.string(),
    /**
     * The actual issuer from the .well-known/smart-configuration response.
     */
    tokenIssuer: z.string(),
    jwksUri: z.string(),
    introspectionEndpoint: z.string(),
    authorizationEndpoint: z.string(),
    tokenEndpoint: z.string(),
    codeVerifier: z.string(),
    state: z.string(),

    /**
     * Used to persist and rehydrate the session-wide validator runtime
     */
    validator: z.string().optional(),
})

export type CompleteSession = z.infer<typeof CompleteSessionSchema>
export const CompleteSessionSchema = InitialSessionSchema.extend({
    accessToken: z.string(),
    idToken: z.string(),
    refreshToken: z.string(),
    patient: z.string(),
    encounter: z.string(),
})

export function idTokenClaims(session: CompleteSession): IdToken {
    return IdTokenSchema.loose().parse(decodeJwt(session.idToken))
}
