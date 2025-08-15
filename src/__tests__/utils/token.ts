import { SignJWT } from 'jose'

import { privateKey } from './jwt'

export async function createTestIdToken(claims: Record<string, unknown>): Promise<string> {
    const token = await new SignJWT({
        fhirUser: 'Practitioner/71503542-c4f5-4f11-a5a5-6633c139d0d4',
        ...claims,
    })
        .setProtectedHeader({ alg: 'RS256', kid: 'foo-bar-baz-kid' })
        .setIssuedAt()
        .setIssuer('http://auth-server')
        .setAudience('test-client')
        .setExpirationTime('1h')
        .sign(await privateKey())

    return token
}

export async function createTestAccessToken(expiresIn: number): Promise<string> {
    const token = await new SignJWT({
        scope: 'openid fhirUser launch/patient',
    })
        .setProtectedHeader({ alg: 'RS256', kid: 'foo-bar-baz-kid' })
        .setIssuedAt()
        .setIssuer('http://auth-server')
        .setAudience('test-client')
        .setExpirationTime(Date.now() / 1000 + expiresIn)
        .sign(await privateKey())

    return token
}

export async function createOtherToken(issuer: string): Promise<string> {
    const token = await new SignJWT()
        .setProtectedHeader({ alg: 'RS256', kid: 'foo-bar-baz-kid' })
        .setIssuedAt()
        .setIssuer(issuer)
        .setAudience('test-client')
        .sign(await privateKey())

    return token
}
