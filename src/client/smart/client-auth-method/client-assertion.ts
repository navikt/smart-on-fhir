import { importJWK, SignJWT } from 'jose'
import * as z from 'zod'

import type { InitialSession } from '../../storage/schema'

import type { ConfidentialAsymmetricMethod } from './config'

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
    session: InitialSession,
    authMode: ConfidentialAsymmetricMethod,
): Promise<string> {
    const jwk = PrivateJwkSchema.parse(authMode.privateKey)
    const signingKey = await importJWK(jwk)

    if (authMode.strictAudienceValidation != true) {
        return await new SignJWT()
            .setProtectedHeader({ alg: jwk.alg, kid: jwk.kid, typ: 'JWT' })
            .setIssuer(clientId)
            .setSubject(clientId)
            /**
             * As per SoF 4.1.5, the audience for authenticating the /token-endpoint should be the /token-endpoint itself,
             * this is more strict than RFC 7523 3.3.
             *
             * For using private_key_jwt for other endpoints such as /introspect or /par, we'll need to research a bit more.
             *
             * See: https://hl7.org/fhir/smart-app-launch/client-confidential-asymmetric.html#authenticating-to-the-token-endpoint
             * See: https://datatracker.ietf.org/doc/html/rfc7523#autoid-7
             */
            .setAudience(session.tokenEndpoint)
            .setJti(crypto.randomUUID())
            .setIssuedAt()
            .setExpirationTime('60s')
            .sign(signingKey)
    } else {
        return await new SignJWT()
            // Typ is normally 'JWT' per the SoF spec, but this is to support Strict Audience Validation
            .setProtectedHeader({ alg: jwk.alg, kid: jwk.kid, typ: 'client-authentication+jwt' })
            .setIssuer(clientId)
            .setSubject(clientId)
            /**
             * As opposed to non-strict audience validation, the audience _must_ be the issuer, and not the token endpoint.
             * This is in theory not applicable to SMART on FHIR, but some authorization servers (e.g. Duende IdentityServer)
             * require this for private_key_jwt authentication when strict audience validation is enabled.
             *
             * See: https://docs.duendesoftware.com/identityserver/tokens/client-authentication/#strict-audience-validation
             */
            .setAudience(session.tokenIssuer)
            .setJti(crypto.randomUUID())
            .setIssuedAt()
            .setExpirationTime('60s')
            .sign(signingKey)
    }
}
