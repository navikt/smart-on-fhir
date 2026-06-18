import { type CryptoKey, exportJWK, importPKCS8, importSPKI, type JSONWebKeySet, type JWK } from 'jose'

import { testOnlyPrivateKey, testOnlyPublicKey } from './test-only-keys'

let keyPair: { publicKey: CryptoKey; privateKey: CryptoKey } | null = null
const getKeyPair = async () => {
    if (keyPair) return keyPair

    const privateKey = await importPKCS8(testOnlyPrivateKey, 'RS256', { extractable: true })
    const publicKey = await importSPKI(testOnlyPublicKey, 'RS256')

    keyPair = { publicKey, privateKey }

    return keyPair
}

async function publicJwk(): Promise<JWK> {
    const { publicKey } = await getKeyPair()

    return await exportJWK(publicKey)
}

export async function privateKey(): Promise<CryptoKey> {
    const { privateKey } = await getKeyPair()

    return privateKey
}

/**
 * The test-only private key as a JWK JSON string, shaped like the `privateKey` a
 * consumer would configure for `private_key_jwt`. Includes the `alg` and `kid` that
 * `createClientAssertion` reads for the JWT header. The matching public key is
 * available via `verifyPublicKey` / `createKeys`.
 */
export async function privateKeyAsJwkString(alg = 'RS384', kid = 'foo-bar-baz-kid'): Promise<string> {
    const { privateKey } = await getKeyPair()
    const jwk = await exportJWK(privateKey)

    return JSON.stringify({ ...jwk, alg, kid })
}

/**
 * The test-only public key, for verifying JWTs signed with the test private key
 * (e.g. a `client_assertion`) using real `jose` verification. The `alg` must match the
 * one used to sign (defaults to `RS384`, matching `privateKeyAsJwkString`).
 */
export async function verifyPublicKey(alg = 'RS384'): Promise<CryptoKey> {
    return await importSPKI(testOnlyPublicKey, alg)
}

export const createKeys = async (): Promise<JSONWebKeySet> => {
    const jwk = await publicJwk()

    return {
        keys: [
            {
                kty: jwk.kty,
                kid: 'foo-bar-baz-kid',
                alg: 'RS256',
                use: 'sig',
                n: jwk.n,
                e: jwk.e,
            },
        ],
    }
}
