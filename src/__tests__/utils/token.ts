import { SignJWT } from 'jose'

import { privateKey } from './jwt'

export async function createTestIdToken(claims: Record<string, unknown>): Promise<string> {
    const token = await new SignJWT(claims)
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
