import { expect, test } from 'vitest'

import { SmartValidatorRuntime } from './smart-validator-runtime'

test('persisting and restoring should work', () => {
    const runtime = new SmartValidatorRuntime()

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
    expect(report).toHaveLength(10)

    const persisted = runtime.export()
    const newRuntime = new SmartValidatorRuntime()
    newRuntime.restore(persisted)

    expect(newRuntime.report()).toEqual(report)
})
