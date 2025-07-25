import nock, { type Scope } from 'nock'

import { createKeys } from '../utils/jwt'

import { AUTH_SERVER, FHIR_SERVER } from './common'

export function fhirNock(): Scope {
    return nock(FHIR_SERVER)
}

export function mockSmartConfiguration(): Scope {
    return nock(FHIR_SERVER)
        .get('/.well-known/smart-configuration')
        .reply(200, {
            issuer: FHIR_SERVER,
            jwks_uri: `${AUTH_SERVER}/jwks`,
            authorization_endpoint: `${AUTH_SERVER}/authorize`,
            token_endpoint: `${AUTH_SERVER}/token`,
        })
}

export function mockJwks(): Scope {
    return nock(AUTH_SERVER)
        .get('/jwks')
        .reply(200, () => createKeys())
}
