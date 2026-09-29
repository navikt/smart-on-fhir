import { expect, test } from 'vitest'
import * as z from 'zod'

import { ReadyClient } from '../client'
import { MockReadyClient } from '../test'
import type {
    FhirBatchResponseBundle,
    FhirDocumentReference,
    FhirPatient,
    FhirSearchsetBundle,
    FhirCondition,
} from '../zod'

const patient: FhirPatient = {
    resourceType: 'Patient',
    id: 'patient-1',
    name: [{ family: 'Doe', given: ['Jane'] }],
}

function client(): MockReadyClient {
    return new MockReadyClient({
        patientId: 'patient-1',
        encounterId: 'encounter-1',
        userId: 'practitioner-1',
        issuerName: 'Demo EHR',
    })
}

// Application functions can require the concrete ReadyClient class without changing their signatures.
async function loadPatient(ready: ReadyClient) {
    return ready.patient.request()
}

test('typed resource replies work through accessors and direct requests', async () => {
    const ready = client()
    const concreteClient: ReadyClient = ready
    ready.on('Patient').get('patient-1').reply(patient).times(2)

    expect(ready.patient).toMatchObject({ type: 'Patient', id: 'patient-1', reference: 'Patient/patient-1' })
    expect(ready.user.fhirUser).toBe('Practitioner/practitioner-1')
    expect(ready.issuerName).toBe('Demo EHR')
    expect(ready).toBeInstanceOf(ReadyClient)
    expect(await loadPatient(concreteClient)).toEqual(patient)
    expect(await ready.request('Patient/patient-1', { cache: { ttl: 60 } })).toEqual(patient)
    ready.assertAllUsed()
})

test('search replies preserve searchset typing and query matching', async () => {
    const ready = client()
    const searchset: FhirSearchsetBundle<FhirCondition> = { resourceType: 'Bundle', type: 'searchset', entry: [] }
    ready.on('Condition').search('patient=patient-1').reply(searchset)

    expect(await ready.request('Condition?patient=patient-1')).toEqual(searchset)
    ready.assertAllUsed()
})

test('missing resources and multi return the normal client error results', async () => {
    const ready = client()
    ready.on('Patient').get('patient-1').reply(patient)
    ready.on('Practitioner').get('practitioner-1').replyNotFound()

    const result = await ready.multi({ patient: ready.patient.request(), practitioner: ready.user.request() })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected a failed multi result')
    expect(result.failedResource).toEqual(['practitioner'])
    expect(result.errors).toEqual([{ error: 'REQUEST_FAILED_RESOURCE_NOT_FOUND' }])
    expect(result.results.patient).toEqual(patient)
    ready.assertAllUsed()
})

test('writes match payloads when requested and return typed replies', async () => {
    const ready = client()
    const document: FhirDocumentReference = {
        resourceType: 'DocumentReference',
        id: 'doc-1',
        meta: { lastUpdated: '2026-09-29T12:00:00Z' },
        status: 'current',
        type: { coding: [] },
        subject: { reference: 'Patient/patient-1' },
        author: [],
        content: [{ attachment: { url: 'https://example.test/doc.pdf' } }],
        context: { encounter: [] },
    }
    const payload = { resourceType: 'DocumentReference' } as const
    ready.onCreate('DocumentReference').withPayload(payload).reply(document)
    ready.onUpdate('DocumentReference', 'doc-1').replyError({ error: 'CREATE_FAILED_NOT_SUPPORTED' })

    expect(await ready.create('DocumentReference', { payload })).toEqual(document)
    expect(await ready.update('DocumentReference', { id: 'doc-1', payload })).toEqual({
        error: 'CREATE_FAILED_NOT_SUPPORTED',
    })
    ready.assertAllUsed()
})

test('batch replies match type and entries', async () => {
    const ready = client()
    const entries = [{ request: { method: 'GET', url: 'Patient/patient-1' } }] as const
    const response: FhirBatchResponseBundle = {
        resourceType: 'Bundle',
        type: 'batch-response',
        entry: [{ response: { status: '200 OK' }, resource: patient }],
    }
    ready
        .onBatch('batch')
        .withPayload([...entries])
        .reply(response)

    expect(await ready.batch('batch', [...entries])).toEqual(response)
    ready.assertAllUsed()
})

test('unexpected calls explain the mismatch; unused and repeated stubs are visible', async () => {
    const ready = client()
    ready.on('Patient').get('patient-1').reply(patient)
    await expect(ready.request('Patient/other')).rejects.toThrow(
        /Unexpected MockReadyClient call: GET Patient\/other.*GET Patient\/patient-1/,
    )
    expect(() => ready.assertAllUsed()).toThrow(/Patient\/patient-1/)
    await ready.patient.request()
    await expect(ready.patient.request()).rejects.toThrow(/Unexpected MockReadyClient call/)
    ready.assertAllUsed()

    ready
        .onCreate('DocumentReference')
        .withPayload({ resourceType: 'DocumentReference' })
        .replyError({ error: 'CREATE_FAILED_NOT_SUPPORTED' })
    await expect(
        ready.create('DocumentReference', { payload: { resourceType: 'DocumentReference', id: 'unexpected' } }),
    ).rejects.toThrow(/with payload/)
    ready.reset()
    ready.assertAllUsed()
})

test('claims, validation and persistent replies can be configured without authentication', async () => {
    const ready = new MockReadyClient({
        patientId: 'patient-1',
        encounterId: 'encounter-1',
        userId: 'practitioner-1',
        claims: { role: 'clinician' },
        valid: false,
        validationReport: [],
    })
    ready.on('Patient').get('patient-1').reply(patient).persist()

    expect(ready.getClaim('role', z.literal('clinician'))).toBe('clinician')
    expect(ready.getClaim('role', z.literal('admin'))).toEqual({ error: 'CLAIM_INVALID' })
    expect(ready.getClaim('missing')).toEqual({ error: 'CLAIM_NOT_FOUND' })
    expect(await ready.validate()).toBe(false)
    expect(ready.getValidationReport()).toEqual([])
    expect(await ready.patient.request()).toEqual(patient)
    expect(await ready.patient.request()).toEqual(patient)
    ready.assertAllUsed()
})
