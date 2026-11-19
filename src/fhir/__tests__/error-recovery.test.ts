import nock from 'nock'
import { expect, test } from 'vitest'

import {
    type ErrorRecoveryStorage,
    safeErrorRecoveryStorage,
    type SafeErrorRecoveryStorage,
} from '#fhir/error-recorder/error-recovery-storage'
import { ErrorRecorder } from '#fhir/error-recorder/ErrorRecorder'
import { ErrorRecoveryClient } from '#fhir/error-recorder/ErrorRecoveryClient'
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

    nock(FHIR_SERVER).post('/DocumentReference').times(3).reply(400, {})

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

    // Get the errors from the ErrorRecoveryClient using the same storage

    const erc = new ErrorRecoveryClient(mockStorage)

    expect(erc.outstandingErrorsCount()).toBe(3)
})

function createMockErrorRecoveryStorage(): ErrorRecoveryStorage {
    const errors = new Map<string, any[]>()

    return {
        add: async (key, request) => {
            console.log(key, request)
        },
        claim: async (key) => {},
        update: async (key, error) => {},
        count: async () => 0,
    }
}
