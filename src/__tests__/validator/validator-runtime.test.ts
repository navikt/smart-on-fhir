import { expect, test } from 'vitest'

import { ValidatorRuntime } from '../../client/validator/ValidatorRuntime'
import type { FhirDocumentReference, FhirEncounter, FhirOrganization, FhirPatient, FhirPractitioner } from '../../zod'
import { expectHas } from '../utils/expect'

test('persisting and restoring should work', () => {
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
    expect(report).toHaveLength(10)

    const persisted = runtime.export()
    const newRuntime = ValidatorRuntime.blank()
    newRuntime.restore(persisted)

    expect(newRuntime.report()).toEqual(report)
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

test('patient validation passes when identifier and name are present', () => {
    const runtime = ValidatorRuntime.blank()

    runtime.patient({
        resourceType: 'Patient',
        id: '2b4b6bd4-0b88-4762-aab5-74776e1f50c4',
        name: [{ family: 'Doe', given: ['Jane'] }],
        identifier: [{ system: 'urn:oid:2.16.578.1.12.4.1.4.1', value: '12345678901' }],
    } satisfies FhirPatient)

    const patient = runtime.report().find((v) => v.type === 'PATIENT')

    expectHas(patient, 'tests')
    expect(patient.status).toEqual('GOOD')
    expect(patient.tests).toContainEqual({
        type: 'INFO',
        message: 'fødselsnummer or d-nummer identifier present in patient',
    })
    expect(patient.tests).toContainEqual({ type: 'INFO', message: 'name present in patient' })
})

test('patient validation accepts d-nummer as identifier', () => {
    const runtime = ValidatorRuntime.blank()

    runtime.patient({
        resourceType: 'Patient',
        id: '2b4b6bd4-0b88-4762-aab5-74776e1f50c4',
        name: [{ family: 'Doe', given: ['Jane'] }],
        identifier: [{ system: 'urn:oid:2.16.578.1.12.4.1.4.2', value: '52345678901' }],
    } satisfies FhirPatient)

    const patient = runtime.report().find((v) => v.type === 'PATIENT')

    expectHas(patient, 'tests')
    expect(patient.status).toEqual('GOOD')
})

test('patient validation fails when identifier is missing', () => {
    const runtime = ValidatorRuntime.blank()

    runtime.patient({
        resourceType: 'Patient',
        id: '2b4b6bd4-0b88-4762-aab5-74776e1f50c4',
        name: [{ family: 'Doe', given: ['Jane'] }],
    } satisfies FhirPatient)

    const patient = runtime.report().find((v) => v.type === 'PATIENT')

    expectHas(patient, 'tests')
    expect(patient.status).toEqual('FAIL')
    expect(patient.tests).toContainEqual({ type: 'ERROR', message: 'identifier is missing' })
})

test('patient validation fails when identifier has neither fødselsnummer nor d-nummer', () => {
    const runtime = ValidatorRuntime.blank()

    runtime.patient({
        resourceType: 'Patient',
        id: '2b4b6bd4-0b88-4762-aab5-74776e1f50c4',
        name: [{ family: 'Doe', given: ['Jane'] }],
        identifier: [{ system: 'urn:oid:some-other-system', value: '12345678901' }],
    } satisfies FhirPatient)

    const patient = runtime.report().find((v) => v.type === 'PATIENT')

    expectHas(patient, 'tests')
    expect(patient.status).toEqual('FAIL')
    expect(patient.tests).toContainEqual({
        type: 'ERROR',
        message:
            'fødselsnummer (urn:oid:2.16.578.1.12.4.1.4.1) or d-nummer (urn:oid:2.16.578.1.12.4.1.4.2) identifier is missing in patient',
    })
})

test('organization validation passes when organisasjonsnummer and phone are present', () => {
    const runtime = ValidatorRuntime.blank()

    runtime.organization({
        resourceType: 'Organization',
        id: '458ae08a-e249-4e16-a9a0-1ba45d358f6c',
        name: 'Legekontoret',
        identifier: [{ system: 'urn:oid:2.16.578.1.12.4.1.4.101', value: '123456789' }],
        telecom: [{ system: 'phone', value: '12345678' }],
    } satisfies FhirOrganization)

    const organization = runtime.report().find((v) => v.type === 'ORGANIZATION')

    expectHas(organization, 'tests')
    expect(organization.status).toEqual('GOOD')
    expect(organization.tests).toContainEqual({
        type: 'INFO',
        message: 'organisasjonsnummer identifier present in organization',
    })
    expect(organization.tests).toContainEqual({ type: 'INFO', message: 'phone telecom present in organization' })
})

test('organization validation fails when organisasjonsnummer identifier is missing', () => {
    const runtime = ValidatorRuntime.blank()

    runtime.organization({
        resourceType: 'Organization',
        id: '458ae08a-e249-4e16-a9a0-1ba45d358f6c',
        name: 'Legekontoret',
        identifier: [{ system: 'urn:oid:some-other-system', value: '123456789' }],
        telecom: [{ system: 'phone', value: '12345678' }],
    } satisfies FhirOrganization)

    const organization = runtime.report().find((v) => v.type === 'ORGANIZATION')

    expectHas(organization, 'tests')
    expect(organization.status).toEqual('FAIL')
    expect(organization.tests).toContainEqual({
        type: 'ERROR',
        message: 'organisasjonsnummer (urn:oid:2.16.578.1.12.4.1.4.101) identifier is missing in organization',
    })
})

test('organization validation fails when phone telecom is missing', () => {
    const runtime = ValidatorRuntime.blank()

    runtime.organization({
        resourceType: 'Organization',
        id: '458ae08a-e249-4e16-a9a0-1ba45d358f6c',
        name: 'Legekontoret',
        identifier: [{ system: 'urn:oid:2.16.578.1.12.4.1.4.101', value: '123456789' }],
        telecom: [{ system: 'email', value: 'post@legekontoret.no' }],
    } satisfies FhirOrganization)

    const organization = runtime.report().find((v) => v.type === 'ORGANIZATION')

    expectHas(organization, 'tests')
    expect(organization.status).toEqual('FAIL')
    expect(organization.tests).toContainEqual({ type: 'ERROR', message: 'phone telecom is missing in organization' })
})

function completeDocumentReference(): FhirDocumentReference {
    return {
        resourceType: 'DocumentReference',
        id: 'unik-document-reference-id',
        status: 'current',
        meta: { lastUpdated: '2026-06-01T00:00:00.000+00:00' },
        description: '100% Sykmelding fra 01.06.2024 til 07.06.2024',
        type: {
            coding: [
                { system: 'urn:oid:2.16.578.1.12.4.1.1.9602', code: 'J01-2', display: 'Sykmeldinger og trygdesaker' },
            ],
        },
        content: [
            {
                attachment: {
                    title: 'Tittel generert av Nav',
                    language: 'NO-nb',
                    contentType: 'application/pdf',
                    data: 'base64 PDF',
                },
            },
        ],
        subject: { reference: 'Patient/2b4b6bd4-0b88-4762-aab5-74776e1f50c4' },
        author: [{ reference: 'Practitioner/40426ee8-6293-456c-9b79-2016821673ca' }],
        context: {
            encounter: [{ reference: 'Encounter/320fd29a-31b9-4c9f-963c-c6c88332d89a' }],
        },
    }
}

test('documentReference validation passes for a complete document reference', () => {
    const runtime = ValidatorRuntime.blank()

    runtime.documentReference(completeDocumentReference())

    const dr = runtime.report().find((v) => v.type === 'DOCUMENT_REFERENCE')

    expectHas(dr, 'tests')
    expect(dr.status).toEqual('GOOD')
    expect(dr.tests).toContainEqual({
        type: 'INFO',
        message: 'context.encounter reference present in documentReference',
    })
    expect(dr.tests).toContainEqual({ type: 'INFO', message: 'type coding J01-2 present in documentReference' })
})

test('documentReference validation fails when context.encounter reference is missing', () => {
    const runtime = ValidatorRuntime.blank()

    runtime.documentReference({
        ...completeDocumentReference(),
        context: { encounter: [] },
    } satisfies FhirDocumentReference)

    const dr = runtime.report().find((v) => v.type === 'DOCUMENT_REFERENCE')

    expectHas(dr, 'tests')
    expect(dr.status).toEqual('FAIL')
    expect(dr.tests).toContainEqual({
        type: 'ERROR',
        message: 'context.encounter reference is missing in documentReference',
    })
})

test('documentReference validation fails when type code is not J01-2', () => {
    const runtime = ValidatorRuntime.blank()

    runtime.documentReference({
        ...completeDocumentReference(),
        type: { coding: [{ system: 'urn:oid:2.16.578.1.12.4.1.1.9602', code: 'X99-9', display: 'Annet' }] },
    } satisfies FhirDocumentReference)

    const dr = runtime.report().find((v) => v.type === 'DOCUMENT_REFERENCE')

    expectHas(dr, 'tests')
    expect(dr.status).toEqual('FAIL')
    expect(dr.tests).toContainEqual({
        type: 'ERROR',
        message: 'type coding J01-2 (urn:oid:2.16.578.1.12.4.1.1.9602) is missing in documentReference',
    })
})

test('documentReference validation warns when description is missing', () => {
    const runtime = ValidatorRuntime.blank()

    const { description: _description, ...withoutDescription } = completeDocumentReference()
    runtime.documentReference(withoutDescription satisfies FhirDocumentReference)

    const dr = runtime.report().find((v) => v.type === 'DOCUMENT_REFERENCE')

    expectHas(dr, 'tests')
    expect(dr.status).toEqual('PASS')
    expect(dr.tests).toContainEqual({ type: 'WARN', message: 'no description present in documentReference' })
})
