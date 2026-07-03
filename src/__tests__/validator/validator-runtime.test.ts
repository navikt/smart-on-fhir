import { expect, test } from 'vitest'

import { ValidatorRuntime } from '../../client/validator/ValidatorRuntime'
import { expectHas } from '../utils/expect'

test('sanity test validator runtime', () => {
    const runtime = ValidatorRuntime.blank()

    runtime.smartConfiguration({
        issuer: 'https://example.com',
        jwks_uri: 'https://example.com/jwks',
        authorization_endpoint: 'https://example.com/authorize',
        grant_types_supported: ['authorization_code', 'refresh_token'],
        token_endpoint: 'https://example.com/token',
        capabilities: ['launch-ehr', 'launch-standalone'],
        code_challenge_methods_supported: ['S256'],
        scopes_supported: ['openid', 'profile', 'patient/*.read'],
        response_types_supported: ['code'],
        token_endpoint_auth_methods_supported: ['private_key_jwt'],
        introspection_endpoint: 'https://example.com/introspect',
        revocation_endpoint: 'https://example.com/revoke',
    })

    const report = runtime.report()

    expect(report).toHaveLength(11)

    const smartConfiguration = report.find((v) => v.type === 'SMART_CONFIGURATION')

    expectHas(smartConfiguration, 'tests')
    expect(smartConfiguration.status).toEqual('GOOD')
    expect(smartConfiguration.tests[0].message).toEqual('refresh_token is supported')
})
