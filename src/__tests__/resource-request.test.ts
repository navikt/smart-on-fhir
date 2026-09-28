import { expect, test } from 'vitest'

import { mockCreateDocumentReference, mockUpdateDocumentReference } from './mocks/create-resources'
import { mockEncounter, mockPatient, mockPractitioner, mockPractitionerWithOperationOutcome } from './mocks/resources'
import { justOpenReadyClient } from './utils/client-open'
import { expectHas } from './utils/expect'

test('SmartClient should be properly initiated with Patient, Encounter and User', async () => {
    const [ready] = await justOpenReadyClient()

    expect(ready.patient.type).toEqual('Patient')
    expect(ready.patient.reference).toEqual('Patient/valid-patient-id')
    expect(ready.patient.id).toEqual('valid-patient-id')

    expect(ready.encounter.type).toEqual('Encounter')
    expect(ready.encounter.reference).toEqual('Encounter/valid-encounter-id')
    expect(ready.encounter.id).toEqual('valid-encounter-id')

    expect(ready.user.fhirUser).toEqual('Practitioner/ac768edb-d56a-4304-8574-f866c6af4e7e')
})

test('SmartClient.request - /Practitioner should fetch and parse Practitioner resource', async () => {
    const [ready] = await justOpenReadyClient()

    const mock = mockPractitioner('ac768edb-d56a-4304-8574-f866c6af4e7e')

    const practitioner = await ready.request(ready.user.fhirUser)

    if ('error' in practitioner) {
        // Verify union types, this should be string, not unknown
        throw Error(`Expected Practitioner to be successful, but got error: ${practitioner.error.toString()}`)
    }

    expect(mock.isDone()).toBe(true)
    expectHas(practitioner, 'resourceType')
    expect(practitioner.resourceType).toBe('Practitioner')
})

test('SmartClient.request - Should handle FHIR errors (OperationOutcome)', async () => {
    const [ready] = await justOpenReadyClient()

    const mock = mockPractitionerWithOperationOutcome('ac768edb-d56a-4304-8574-f866c6af4e7e')
    const practitioner = await ready.request(ready.user.fhirUser)

    expect(mock.isDone()).toBe(true)
    expectHas(practitioner, 'error')
    expectHas(practitioner, 'operationOutcome')
})

test('SmartClient.create - /DocumentReference should POST and parse DocumentReference resource', async () => {
    const [ready] = await justOpenReadyClient()

    const mock = mockCreateDocumentReference({
        resourceType: 'DocumentReference',
    })
    const documentReference = await ready.create('DocumentReference', {
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

test('SmartClient.update - /DocumentReference should PUT and parse DocumentReference resource', async () => {
    const [ready] = await justOpenReadyClient()

    const mock = mockUpdateDocumentReference({
        expectedId: 'my-id',
        expectedPayload: {
            resourceType: 'DocumentReference',
        },
    })

    const documentReference = await ready.update('DocumentReference', {
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

test('shorthand for .request Practitioner should fetch and parse Practitioner resource', async () => {
    const [ready] = await justOpenReadyClient()

    mockPractitioner('ac768edb-d56a-4304-8574-f866c6af4e7e')
    const practitioner = await ready.user.request()

    expectHas(practitioner, 'resourceType')
    expect(practitioner.resourceType).toBe('Practitioner')
})

test('shorthand for .request Encounter should fetch and parse Encounter resource', async () => {
    const [ready] = await justOpenReadyClient()

    mockEncounter('valid-encounter-id')
    const encounter = await ready.encounter.request()

    expectHas(encounter, 'resourceType')
    expect(encounter.resourceType).toBe('Encounter')
})

test('shorthand for .request Patient should fetch and parse Patient resource', async () => {
    const [ready] = await justOpenReadyClient()

    mockPatient('valid-patient-id')
    const encounter = await ready.patient.request()

    expectHas(encounter, 'resourceType')
    expect(encounter.resourceType).toBe('Patient')
})
