import nock, { type Scope } from 'nock'

import type { FhirEncounter, FhirPatient, FhirPractitioner } from '../../zod'

export function mockPractitioner(id: string): Scope {
    return nock('http://fhir-server')
        .get(`/Practitioner/${id}`)
        .reply(200, {
            resourceType: 'Practitioner',
            id: '40426ee8-6293-456c-9b79-2016821673ca',
            name: [{ family: 'Doe', given: ['John'] }],
            identifier: [{ system: 'urn:oid:2.16.578.1.12.4.1.4.4', value: '9144889' }],
        } satisfies FhirPractitioner)
}

export function mockPractitionerWithOperationOutcome(id: string): Scope {
    return nock('http://fhir-server')
        .get(`/Practitioner/${id}`)
        .reply(
            500,
            {
                resourceType: 'OperationOutcome',
                id: '259e8ad3-1def-456e-93dd-09840f689cc4',
                meta: {
                    lastUpdated: '2026-02-16T14:11:13.6531423+00:00',
                },
                issue: [
                    {
                        severity: 'error',
                        code: 'exception',
                        diagnostics: 'Unexpected exception on resource Practitioner',
                    },
                ],
            },
            {
                'Content-Type': 'application/fhir+json',
            },
        )
}

export function mockEncounter(id: string): Scope {
    return nock('http://fhir-server')
        .get(`/Encounter/${id}`)
        .reply(200, {
            resourceType: 'Encounter',
            id: '320fd29a-31b9-4c9f-963c-c6c88332d89a',
            status: 'in-progress',
            reasonCode: [
                {
                    coding: [
                        {
                            system: 'urn:oid:2.16.578.1.12.4.1.1.7170',
                            display: 'Angstlidelse',
                            code: 'P74',
                        },
                    ],
                },
            ],
            diagnosis: [
                {
                    condition: {
                        type: 'Condition',
                        reference: 'Condition/ff0dba18-b879-4fd2-b047-15f58f21696e',
                    },
                },
            ],
            serviceProvider: {
                reference: 'Organization/458ae08a-e249-4e16-a9a0-1ba45d358f6c',
            },
        } satisfies FhirEncounter)
}

export function mockPatient(id: string): Scope {
    return nock('http://fhir-server')
        .get(`/Patient/${id}`)
        .reply(200, {
            resourceType: 'Patient',
            id: '2b4b6bd4-0b88-4762-aab5-74776e1f50c4',
            name: [{ family: 'Doe', given: ['Jane'] }],
            identifier: [{ system: 'urn:oid:2.16.578.1.12.4.1.4.1', value: '12345678901' }],
        } satisfies FhirPatient)
}
