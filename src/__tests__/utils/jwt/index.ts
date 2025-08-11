import { type CryptoKey, exportJWK, importPKCS8, importSPKI, type JSONWebKeySet, type JWK } from 'jose'

import { testOnlyPrivateKey, testOnlyPublicKey } from './test-only-keys'

let keyPair: { publicKey: CryptoKey; privateKey: CryptoKey } | null = null
const getKeyPair = async () => {
    if (keyPair) return keyPair

    const privateKey = await importPKCS8(testOnlyPrivateKey, 'RS256')
    const publicKey = await importSPKI(testOnlyPublicKey, 'RS256')

    keyPair = { publicKey, privateKey }

    return keyPair
}

export async function publicJwk(): Promise<JWK> {
    const { publicKey } = await getKeyPair()

    return await exportJWK(publicKey)
}

export async function privateKey(): Promise<CryptoKey> {
    const { privateKey } = await getKeyPair()

    return privateKey
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
