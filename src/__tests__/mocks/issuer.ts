import nock, { type Scope } from 'nock'

import type { SmartConfiguration } from '../../client/smart/well-known/smart-configuration-schema'
import { createKeys } from '../utils/jwt'

import { AUTH_SERVER, FHIR_SERVER } from './common'

export function fhirNock(): Scope {
    return nock(FHIR_SERVER)
}

export function mockSmartConfiguration(): Scope {
    return nock(FHIR_SERVER)
        .get('/.well-known/smart-configuration')
        .reply(200, {
            issuer: AUTH_SERVER,
            jwks_uri: `${AUTH_SERVER}/jwks`,
            introspection_endpoint: `${AUTH_SERVER}/introspect`,
            authorization_endpoint: `${AUTH_SERVER}/authorize`,
            token_endpoint: `${AUTH_SERVER}/token`,
        } satisfies SmartConfiguration)
}

export function mockJwks(): Scope {
    return nock(AUTH_SERVER)
        .get('/jwks')
        .reply(200, () => createKeys())
}
