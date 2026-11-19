import nock from 'nock'
import { expect, test } from 'vitest'

import { type ErrorRecoveryStorage, safeErrorRecoveryStorage } from '#fhir/error-recorder/error-recovery-storage'
import type { RecoverableRequest } from '#fhir/error-recorder/error-recovery-types'
import { ErrorRecorder } from '#fhir/error-recorder/ErrorRecorder'
import { FhirClient } from '#fhir/FhirClient'
import { FHIR_SERVER } from '#test-utils/mocks'

test(`FhirClient with ErrorRecorder`, async () => {
    const mockStorage = createMockErrorRecoveryStorage()
    const errorRecorder = new ErrorRecorder({
        errorGroupKey: 'test-group-id',
        // TODO: Bad API for standalone users
        storage: safeErrorRecoveryStorage(mockStorage),
    })

    const fhir = new FhirClient({ fhirServer: FHIR_SERVER }, { errorRecorder: errorRecorder })

    nock(FHIR_SERVER).post('/DocumentReference').times(3).reply(400, { foo: 'bar' })

    await fhir.create('DocumentReference', {
        payload: { resourceType: 'DocumentReference', id: 'first-error' },
        recoverable: true,
    })
    await fhir.create('DocumentReference', {
        payload: { resourceType: 'DocumentReference', id: 'second-error' },
        recoverable: true,
    })
    const last = await fhir.create('DocumentReference', {
        payload: { resourceType: 'DocumentReference', id: 'third-error' },
        recoverable: true,
    })

    expect(last).toMatchObject({ error: 'CREATE_FAILED_NON_OK_RESPONSE' })
    expect(await mockStorage.take('test-group-id')).toEqual([
        {
            fhirServer: 'http://fhir-server',
            method: 'POST',
            path: 'DocumentReference',
            recordedAt: expect.any(String),
            attempts: 0,
            error: {
                message: expect.stringContaining('Non-operation outcome JSON error:'),
                stack: expect.any(String),
                operationOutcome: null,
            },
            payload: {
                id: 'first-error',
                resourceType: 'DocumentReference',
            },
        } satisfies RecoverableRequest,
        {
            fhirServer: 'http://fhir-server',
            method: 'POST',
            path: 'DocumentReference',
            recordedAt: expect.any(String),
            attempts: 0,
            error: {
                message: expect.stringContaining('Non-operation outcome JSON error:'),
                stack: expect.any(String),
                operationOutcome: null,
            },
            payload: {
                id: 'second-error',
                resourceType: 'DocumentReference',
            },
        } satisfies RecoverableRequest,
        {
            fhirServer: 'http://fhir-server',
            method: 'POST',
            path: 'DocumentReference',
            recordedAt: expect.any(String),
            attempts: 0,
            error: {
                message: expect.stringContaining('Non-operation outcome JSON error:'),
                stack: expect.any(String),
                operationOutcome: null,
            },
            payload: {
                id: 'third-error',
                resourceType: 'DocumentReference',
            },
        } satisfies RecoverableRequest,
    ])

    expect(await mockStorage.keys()).toHaveLength(0)
})

function createMockErrorRecoveryStorage(): ErrorRecoveryStorage {
    const errors = new Map<string, unknown[]>()

    return {
        record: async (key, request) => {
            errors.set(key, [...(errors.get(key) ?? []), request])
        },
        take: async (key) => {
            const taken = errors.get(key) ?? []
            errors.delete(key)
            return taken
        },
        keys: async () => {
            return Array.from(errors.keys())
        },
    }
}
