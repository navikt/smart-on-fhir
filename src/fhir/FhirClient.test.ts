import { expect, test } from 'vitest'

import { expectHas } from '../internal/test-utils/expect'
import { FHIR_SERVER } from '../internal/test-utils/mocks/common'
import { mockCreateDocumentReference, mockUpdateDocumentReference } from '../internal/test-utils/mocks/create-resources'
import { mockPractitioner, mockPractitionerWithOperationOutcome } from '../internal/test-utils/mocks/resources'

import { FhirClient } from './FhirClient'

test('FhirClient.request - /Practitioner should fetch and parse Practitioner resource', async () => {
    const client = new FhirClient({ fhirServer: FHIR_SERVER })

    const mock = mockPractitioner('ac768edb-d56a-4304-8574-f866c6af4e7e')
    const practitioner = await client.request(`Practitioner/ac768edb-d56a-4304-8574-f866c6af4e7e`)

    if ('error' in practitioner) {
        // Verify union types, this should be string, not unknown
        throw Error(`Expected Practitioner to be successful, but got error: ${practitioner.error.toString()}`)
    }

    expect(mock.isDone()).toBe(true)
    expectHas(practitioner, 'resourceType')
    expect(practitioner.resourceType).toBe('Practitioner')
})

test('FhirClient.request - Should handle FHIR errors (OperationOutcome)', async () => {
    const client = new FhirClient({ fhirServer: FHIR_SERVER })

    const mock = mockPractitionerWithOperationOutcome('ac768edb-d56a-4304-8574-f866c6af4e7e')
    const practitioner = await client.request(`Practitioner/ac768edb-d56a-4304-8574-f866c6af4e7e`)

    expect(mock.isDone()).toBe(true)
    expectHas(practitioner, 'error')
    expectHas(practitioner, 'operationOutcome')
})

test('FhirClient.create - /DocumentReference should POST and parse DocumentReference resource', async () => {
    const client = new FhirClient({ fhirServer: FHIR_SERVER })

    const mock = mockCreateDocumentReference({
        resourceType: 'DocumentReference',
    })
    const documentReference = await client.create('DocumentReference', {
        // Payload is contrivedly small for test
        payload: { resourceType: 'DocumentReference' },
    })

    if ('error' in documentReference) {
        // Verify union types, this should be string, not unknown
        throw Error(`Expected DocumentReference to be successful, but got error: ${documentReference.error.toString()}`)
    }

    expect(mock.isDone()).toBe(true)
    expectHas(documentReference, 'resourceType')
    expect(documentReference.resourceType).toBe('DocumentReference')
})

test('FhirClient.update - /DocumentReference should PUT and parse DocumentReference resource', async () => {
    const client = new FhirClient({ fhirServer: FHIR_SERVER })

    const mock = mockUpdateDocumentReference({
        expectedId: 'my-id',
        expectedPayload: {
            resourceType: 'DocumentReference',
        },
    })

    const documentReference = await client.update('DocumentReference', {
        id: 'my-id',
        // Payload is contrivedly small for test
        payload: { resourceType: 'DocumentReference' },
    })

    if ('error' in documentReference) {
        // Verify union types, this should be string, not unknown
        throw Error(`Expected DocumentReference to be successful, but got error: ${documentReference.error.toString()}`)
    }

    expect(mock.isDone()).toBe(true)
    expectHas(documentReference, 'resourceType')
    expect(documentReference.resourceType).toBe('DocumentReference')
})
