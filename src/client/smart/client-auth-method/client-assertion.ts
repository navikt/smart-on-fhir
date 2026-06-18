import { importJWK, SignJWT } from 'jose'
import * as z from 'zod'

/**
 * Validates only the JWK fields we use directly: `alg` and `kid` for the JWT header
 * (which `jose` does not enforce), and `kty`. The remaining key material is passed
 * through via `.loose()` and validated by `jose` on import.
 */
const PrivateJwkSchema = z
    .string()
    .transform((raw, ctx) => {
        try {
            return JSON.parse(raw)
        } catch {
            ctx.addIssue({ code: 'custom', message: 'privateKey is not valid JSON (expected a JWK)' })
            return z.NEVER
        }
    })
    .pipe(z.object({ kty: z.string(), alg: z.string(), kid: z.string() }).loose())

/**
 * Builds and signs a client assertion JWT for private_key_jwt client authentication,
 * proving the client controls the private key registered with the authorization server.
 * See RFC 7523 section 3 for the claim set.
 *
 * https://datatracker.ietf.org/doc/html/rfc7523#autoid-7
 */
export async function createClientAssertion(
    clientId: string,
    tokenEndpoint: string,
    rawPrivateKey: string,
): Promise<string> {
    const jwk = PrivateJwkSchema.parse(rawPrivateKey)
    const signingKey = await importJWK(jwk)

    return await new SignJWT()
        .setProtectedHeader({ alg: jwk.alg, kid: jwk.kid, typ: 'JWT' })
        .setIssuer(clientId)
        .setSubject(clientId)
        /**
         * As per SoF 4.1.5, the audience for authenticating the /token-endpoint should be the /token-endpoint itself,
         * this is more strict than RFC 7523 3.3.
         *
         * For using private_key_jwt for other endpoints such as /introspect or /par, we'll need to reseach a bit more.
         *
         * See: https://hl7.org/fhir/smart-app-launch/client-confidential-asymmetric.html#authenticating-to-the-token-endpoint
         * See: https://datatracker.ietf.org/doc/html/rfc7523#autoid-7
         */
        .setAudience(tokenEndpoint)
        .setJti(crypto.randomUUID())
        .setIssuedAt()
        .setExpirationTime('60s')
        .sign(signingKey)
}
