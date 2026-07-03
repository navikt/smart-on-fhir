import { expect, test } from 'vitest'

import { ValidatorRuntime } from '../../client/validator/ValidatorRuntime'
import type { FhirEncounter, FhirPractitioner } from '../../zod'
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

test('encounter validation passes for a complete encounter', () => {
    const runtime = ValidatorRuntime.blank()

    runtime.encounter({
        resourceType: 'Encounter',
        id: '320fd29a-31b9-4c9f-963c-c6c88332d89a',
        status: 'in-progress',
        subject: { reference: 'Patient/2b4b6bd4-0b88-4762-aab5-74776e1f50c4' },
        participant: [{ individual: { reference: 'Practitioner/40426ee8-6293-456c-9b79-2016821673ca' } }],
        serviceProvider: { reference: 'Organization/458ae08a-e249-4e16-a9a0-1ba45d358f6c' },
        diagnosis: [{ condition: { reference: 'Condition/ff0dba18-b879-4fd2-b047-15f58f21696e' } }],
        type: [{ coding: [{ system: 'urn:oid:2.16.578.1.12.4.1.1.8432', code: '1' }] }],
    } satisfies FhirEncounter & { type: unknown })

    const encounter = runtime.report().find((v) => v.type === 'ENCOUNTER')

    expectHas(encounter, 'tests')
    expect(encounter.status).toEqual('GOOD')
})

test('encounter validation fails when subject and participant are missing', () => {
    const runtime = ValidatorRuntime.blank()

    runtime.encounter({
        resourceType: 'Encounter',
        id: '320fd29a-31b9-4c9f-963c-c6c88332d89a',
        status: 'in-progress',
        serviceProvider: { reference: 'Organization/458ae08a-e249-4e16-a9a0-1ba45d358f6c' },
    } satisfies FhirEncounter)

    const encounter = runtime.report().find((v) => v.type === 'ENCOUNTER')

    expectHas(encounter, 'tests')
    expect(encounter.status).toEqual('FAIL')
    expect(encounter.tests).toContainEqual({ type: 'ERROR', message: 'subject is missing' })
    expect(encounter.tests).toContainEqual({ type: 'ERROR', message: 'participant is missing' })
})

test('practitioner validation passes when hpr-nummer identifier is present', () => {
    const runtime = ValidatorRuntime.blank()

    runtime.practitioner({
        resourceType: 'Practitioner',
        id: '40426ee8-6293-456c-9b79-2016821673ca',
        name: [{ family: 'Doe', given: ['John'] }],
        identifier: [{ system: 'urn:oid:2.16.578.1.12.4.1.4.4', value: '9144889' }],
    } satisfies FhirPractitioner)

    const practitioner = runtime.report().find((v) => v.type === 'PRACTITIONER')

    expectHas(practitioner, 'tests')
    expect(practitioner.status).toEqual('GOOD')
    expect(practitioner.tests).toContainEqual({
        type: 'INFO',
        message: 'hpr-nummer identifier present in practitioner',
    })
})

test('practitioner validation fails when hpr-nummer identifier is missing', () => {
    const runtime = ValidatorRuntime.blank()

    runtime.practitioner({
        resourceType: 'Practitioner',
        id: '40426ee8-6293-456c-9b79-2016821673ca',
        name: [{ family: 'Doe', given: ['John'] }],
        identifier: [{ system: 'urn:oid:some-other-system', value: '9144889' }],
    } satisfies FhirPractitioner)

    const practitioner = runtime.report().find((v) => v.type === 'PRACTITIONER')

    expectHas(practitioner, 'tests')
    expect(practitioner.status).toEqual('FAIL')
    expect(practitioner.tests).toContainEqual({
        type: 'ERROR',
        message: 'hpr-nummer identifier (urn:oid:2.16.578.1.12.4.1.4.4) is missing in practitioner',
    })
})
