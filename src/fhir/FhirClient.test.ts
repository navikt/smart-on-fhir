import { expect, test } from 'vitest'

import { expectHas } from '#test-utils/expect'
import { mockCreateDocumentReference, mockUpdateDocumentReference } from '#test-utils/mocks'
import { fhirNock, mockPractitioner, mockPractitionerWithOperationOutcome } from '#test-utils/mocks'

import { createOpenFhirClient } from './__tests__/utils/fhir-client-open'

test('FhirClient.request - /Practitioner should fetch and parse Practitioner resource', async () => {
    const client = createOpenFhirClient()

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
    const client = createOpenFhirClient()

    const mock = mockPractitionerWithOperationOutcome('ac768edb-d56a-4304-8574-f866c6af4e7e')
    const practitioner = await client.request(`Practitioner/ac768edb-d56a-4304-8574-f866c6af4e7e`)

    expect(mock.isDone()).toBe(true)
    expectHas(practitioner, 'error')
    expectHas(practitioner, 'operationOutcome')
})

test('FhirClient.request - Should return RESOURCE_NOT_FOUND on 404', async () => {
    const client = createOpenFhirClient()

    const mock = fhirNock().get('/Practitioner/missing').reply(404)
    const practitioner = await client.request('Practitioner/missing')

    expect(mock.isDone()).toBe(true)
    expect(practitioner).toEqual({ error: 'REQUEST_FAILED_RESOURCE_NOT_FOUND', operationOutcome: null })
})

test('FhirClient.request - Should return NON_OK_RESPONSE with null operationOutcome on non-FHIR error body', async () => {
    const client = createOpenFhirClient()

    const mock = fhirNock()
        .get('/Practitioner/some-id')
        .reply(500, { message: 'Internal error' }, { 'Content-Type': 'application/json' })
    const practitioner = await client.request('Practitioner/some-id')

    expect(mock.isDone()).toBe(true)
    expect(practitioner).toEqual({ error: 'REQUEST_FAILED_NON_OK_RESPONSE', operationOutcome: null })
})

test('FhirClient.request - Should return NON_OK_RESPONSE when fetch itself fails', async () => {
    const client = createOpenFhirClient()

    const mock = fhirNock().get('/Practitioner/some-id').replyWithError('Connection refused')
    const practitioner = await client.request('Practitioner/some-id')

    expect(mock.isDone()).toBe(true)
    expect(practitioner).toEqual({ error: 'REQUEST_FAILED_NON_OK_RESPONSE', operationOutcome: null })
})

test('FhirClient.request - Should return INVALID_RESPONSE when response does not match schema', async () => {
    const client = createOpenFhirClient()

    const mock = fhirNock().get('/Practitioner/some-id').reply(200, { not: 'a practitioner' })
    const practitioner = await client.request('Practitioner/some-id')

    expect(mock.isDone()).toBe(true)
    expect(practitioner).toEqual({ error: 'REQUEST_FAILED_INVALID_RESPONSE' })
})

test('FhirClient.create - Should return NOT_SUPPORTED on 405', async () => {
    const client = createOpenFhirClient()

    const mock = fhirNock().post('/DocumentReference').reply(405)
    const result = await client.create('DocumentReference', { payload: { resourceType: 'DocumentReference' } })

    expect(mock.isDone()).toBe(true)
    expect(result).toEqual({ error: 'CREATE_FAILED_NOT_SUPPORTED', operationOutcome: null })
})

test('FhirClient.create - Should return FETCH_FAILED when fetch itself fails', async () => {
    const client = createOpenFhirClient()

    const mock = fhirNock().post('/DocumentReference').replyWithError('Connection refused')
    const result = await client.create('DocumentReference', { payload: { resourceType: 'DocumentReference' } })

    expect(mock.isDone()).toBe(true)
    expect(result).toEqual({ error: 'CREATE_FAILED_FETCH_FAILED', operationOutcome: null })
})

test('FhirClient.update - Should return NON_OK_RESPONSE on 500', async () => {
    const client = createOpenFhirClient()

    const mock = fhirNock().put('/DocumentReference/my-id').reply(500, 'Boom', { 'Content-Type': 'text/plain' })
    const result = await client.update('DocumentReference', {
        id: 'my-id',
        payload: { resourceType: 'DocumentReference' },
    })

    expect(mock.isDone()).toBe(true)
    expect(result).toEqual({ error: 'CREATE_FAILED_NON_OK_RESPONSE', operationOutcome: null })
})

test('FhirClient.batch - Should return NON_OK_RESPONSE when fetch itself fails', async () => {
    const client = createOpenFhirClient()

    const mock = fhirNock().post('/Bundle').replyWithError('Connection refused')
    const result = await client.batch('batch', [])

    expect(mock.isDone()).toBe(true)
    expect(result).toEqual({ error: 'BATCH_FAILED_NON_OK_RESPONSE', operationOutcome: null })
})

test('FhirClient.create - /DocumentReference should POST and parse DocumentReference resource', async () => {
    const client = createOpenFhirClient()

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
    const client = createOpenFhirClient()

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
