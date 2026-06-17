import { createRemoteJWKSet } from 'jose'

/**
 * Simple per URL jwkSet cache. Jose will itself cache the key it fetches, but only per createRemoteJWKSet.
 */
const remoteJWKSetCache: Record<string, ReturnType<typeof createRemoteJWKSet>> = {}
export function getJwkSet(jwksUri: string): ReturnType<typeof createRemoteJWKSet> {
    if (remoteJWKSetCache[jwksUri] == null) {
        remoteJWKSetCache[jwksUri] = createRemoteJWKSet(new URL(jwksUri))
    }

    return remoteJWKSetCache[jwksUri]
}
