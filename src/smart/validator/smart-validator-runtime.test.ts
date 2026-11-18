import { expect, test, vi } from 'vitest'

import { FhirValidatorRuntime } from '../../fhir/validation/fhir-validator-runtime'

import { SmartValidatorRuntime } from './smart-validator-runtime'
import { allSmartValidations } from './validations'

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

function unsignedJwt(payload: Record<string, unknown>): string {
    const encode = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url')
    return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.`
}

test('everything: smart and fhir validations across a persisted and restored session produce a full report', () => {
    vi.useFakeTimers()
    try {
        /**
         * Session 1: launch, token exchange and initial FHIR reads
         */
        vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'))
        const launchRuntime = new SmartValidatorRuntime()
        const launchFhirRuntime = new FhirValidatorRuntime(launchRuntime.validations)

        vi.setSystemTime(new Date('2026-01-01T10:00:01.000Z'))
        launchRuntime.smartConfiguration({
            issuer: 'https://example.com',
            jwks_uri: 'https://example.com/jwks',
            authorization_endpoint: 'https://example.com/authorize',
            grant_types_supported: ['authorization_code'],
            token_endpoint: 'https://example.com/token',
            capabilities: ['launch-ehr'],
            code_challenge_methods_supported: ['S256'],
            scopes_supported: ['openid', 'fhirUser'],
            response_types_supported: ['code'],
            token_endpoint_auth_methods_supported: ['private_key_jwt'],
            introspection_endpoint: 'https://example.com/introspect',
        })

        vi.setSystemTime(new Date('2026-01-01T10:00:02.000Z'))
        launchRuntime.tokenResponse({
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            id_token: unsignedJwt({
                fhirUser: 'Practitioner/40426ee8-6293-456c-9b79-2016821673ca',
            }),
            patient: '2b4b6bd4-0b88-4762-aab5-74776e1f50c4',
            encounter: '320fd29a-31b9-4c9f-963c-c6c88332d89a',
            practitioner: '40426ee8-6293-456c-9b79-2016821673ca',
        })

        vi.setSystemTime(new Date('2026-01-01T10:00:03.000Z'))
        launchFhirRuntime.patient({
            resourceType: 'Patient',
            id: '2b4b6bd4-0b88-4762-aab5-74776e1f50c4',
            name: [{ family: 'Doe', given: ['Jane'] }],
            identifier: [{ system: 'urn:oid:2.16.578.1.12.4.1.4.1', value: '12345678901' }],
        })
        launchFhirRuntime.encounter({
            resourceType: 'Encounter',
            id: '320fd29a-31b9-4c9f-963c-c6c88332d89a',
            status: 'in-progress',
            serviceProvider: {
                reference: 'Organization/458ae08a-e249-4e16-a9a0-1ba45d358f6c',
            },
        })

        // FHIR validations are written into the shared smart session state
        expect(launchRuntime.report().find((v) => v.type === 'PATIENT')?.status).toEqual('OK')
        expect(launchRuntime.report().find((v) => v.type === 'ENCOUNTER')?.status).toEqual('ERROR')

        const persistedAfterLaunch = launchRuntime.export()

        /**
         * Session 2: new request, restore the previous state and continue
         */
        vi.setSystemTime(new Date('2026-01-01T10:05:00.000Z'))
        const runtime = new SmartValidatorRuntime()
        runtime.restore(persistedAfterLaunch)
        expect(runtime.report()).toEqual(launchRuntime.report())

        const fhirRuntime = new FhirValidatorRuntime(runtime.validations)

        vi.setSystemTime(new Date('2026-01-01T10:05:01.000Z'))
        // Re-validating the encounter in the new session supersedes the failed one
        fhirRuntime.encounter({
            resourceType: 'Encounter',
            id: '320fd29a-31b9-4c9f-963c-c6c88332d89a',
            status: 'in-progress',
            subject: { reference: 'Patient/2b4b6bd4-0b88-4762-aab5-74776e1f50c4' },
            participant: [
                {
                    individual: {
                        reference: 'Practitioner/40426ee8-6293-456c-9b79-2016821673ca',
                    },
                },
            ],
            serviceProvider: {
                reference: 'Organization/458ae08a-e249-4e16-a9a0-1ba45d358f6c',
            },
            diagnosis: [
                {
                    condition: {
                        reference: 'Condition/ff0dba18-b879-4fd2-b047-15f58f21696e',
                    },
                },
            ],
            type: [{ coding: [{ system: 'urn:oid:2.16.578.1.12.4.1.1.8432', code: '1' }] }],
        })
        fhirRuntime.practitioner({
            resourceType: 'Practitioner',
            id: '40426ee8-6293-456c-9b79-2016821673ca',
            name: [{ family: 'Doe', given: ['John'] }],
            identifier: [{ system: 'urn:oid:some-other-system', value: '9144889' }],
        })
        fhirRuntime.organization({
            resourceType: 'Organization',
            id: '458ae08a-e249-4e16-a9a0-1ba45d358f6c',
            name: 'Legekontoret',
            identifier: [{ system: 'urn:oid:2.16.578.1.12.4.1.4.101', value: '123456789' }],
            telecom: [{ system: 'phone', value: '12345678' }],
        })

        vi.setSystemTime(new Date('2026-01-01T10:05:02.000Z'))
        fhirRuntime.documentReference({
            resourceType: 'DocumentReference',
            id: 'unik-document-reference-id',
            status: 'current',
            meta: { lastUpdated: '2026-01-01T10:05:02.000+00:00' },
            type: {
                coding: [
                    {
                        system: 'urn:oid:2.16.578.1.12.4.1.1.9602',
                        code: 'J01-2',
                        display: 'Sykmeldinger og trygdesaker',
                    },
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
        })
        fhirRuntime.questionnaireResponse({
            resourceType: 'QuestionnaireResponse',
            id: 'unik-questionnaire-response-id',
            status: 'completed',
            questionnaire: 'https://www.nav.no/samarbeidspartner/sykmelding/fhir/R4/Questionnaire/V1',
            subject: { reference: 'Patient/2b4b6bd4-0b88-4762-aab5-74776e1f50c4' },
            encounter: {
                reference: 'Encounter/320fd29a-31b9-4c9f-963c-c6c88332d89a',
            },
            author: {
                reference: 'Practitioner/40426ee8-6293-456c-9b79-2016821673ca',
            },
            authored: '2026-01-01T10:05:00+00:00',
            item: [],
        })

        vi.setSystemTime(new Date('2026-01-01T10:05:03.000Z'))
        runtime.tokenRefreshResponse({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            patient: '2b4b6bd4-0b88-4762-aab5-74776e1f50c4',
        })

        // Restoring the stale launch state again must not overwrite newer validations
        runtime.restore(persistedAfterLaunch)

        /**
         * Session 3: persist and restore once more, the full report should survive intact
         */
        const finalRuntime = new SmartValidatorRuntime()
        finalRuntime.restore(runtime.export())

        const report = finalRuntime.report()
        expect(report).toEqual(runtime.report())
        expect(report).toHaveLength(allSmartValidations.length)
        expect(report.map((v) => v.type)).toEqual([...allSmartValidations])

        const byType = Object.fromEntries(report.map((v) => [v.type, v]))

        expect(byType['SMART_CONFIGURATION']).toEqual({
            type: 'SMART_CONFIGURATION',
            at: '2026-01-01T10:00:01.000Z',
            status: 'WARNING',
            tests: expect.arrayContaining([
                { type: 'WARNING', message: 'refresh_token is not supported' },
                {
                    type: 'OK',
                    message:
                        'token_endpoint_auth_methods_supported supports at least one of private_key_jwt, client_secret_post, client_secret_basic',
                },
            ]),
        })
        expect(byType['TOKEN_RESPONSE']).toEqual({
            type: 'TOKEN_RESPONSE',
            at: '2026-01-01T10:00:02.000Z',
            status: 'WARNING',
            tests: [
                {
                    type: 'WARNING',
                    message: 'practitioner should not be part of the token response',
                },
            ],
        })
        expect(byType['ID_TOKEN']).toMatchObject({
            at: '2026-01-01T10:00:02.000Z',
            status: 'OK',
        })
        expect(byType['TOKEN_REFRESH_RESPONSE']).toEqual({
            type: 'TOKEN_REFRESH_RESPONSE',
            at: '2026-01-01T10:05:03.000Z',
            status: 'WARNING',
            tests: [
                {
                    type: 'WARNING',
                    message: 'patient should not be part of the token refresh response',
                },
            ],
        })
        expect(byType['PATIENT']).toMatchObject({
            at: '2026-01-01T10:00:03.000Z',
            status: 'OK',
        })
        expect(byType['ENCOUNTER']).toMatchObject({
            at: '2026-01-01T10:05:01.000Z',
            status: 'OK',
        })
        expect(byType['PRACTITIONER']).toMatchObject({
            at: '2026-01-01T10:05:01.000Z',
            status: 'ERROR',
            tests: expect.arrayContaining([
                {
                    type: 'ERROR',
                    message: 'hpr-nummer identifier (urn:oid:2.16.578.1.12.4.1.4.4) is missing in practitioner',
                },
            ]),
        })
        expect(byType['ORGANIZATION']).toMatchObject({
            at: '2026-01-01T10:05:01.000Z',
            status: 'OK',
        })
        expect(byType['DOCUMENT_REFERENCE']).toMatchObject({
            at: '2026-01-01T10:05:02.000Z',
            status: 'WARNING',
            tests: expect.arrayContaining([
                {
                    type: 'WARNING',
                    message: 'no description present in documentReference',
                },
            ]),
        })
        expect(byType['QUESTIONNAIRE_RESPONSE']).toMatchObject({
            at: '2026-01-01T10:05:02.000Z',
            status: 'OK',
        })

        // Nothing should be left unvalidated
        expect(report.filter((v) => v.status === 'UNVALIDATED')).toEqual([])
    } finally {
        vi.useRealTimers()
    }
})
