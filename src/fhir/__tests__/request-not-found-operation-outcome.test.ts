import nock from 'nock'
import { expect, test } from 'vitest'

import { expectHas } from '#test-utils/expect'
import { FHIR_SERVER } from '#test-utils/mocks'

import { createOpenFhirClient } from './utils/fhir-client-open'

const operationOutcome = {
    resourceType: 'OperationOutcome',
    id: 'a95b1c8b-9a0e-4a4f-8d3f-3f6a1a4e2b71',
    meta: {
        lastUpdated: '2026-02-16T14:11:13.6531423+00:00',
    },
    issue: [
        {
            severity: 'information',
            code: 'not-supported',
            diagnostics: 'QuestionnaireResponse is not implemented on this server',
        },
    ],
}

test('FhirClient.request - 404 preserves the OperationOutcome instead of discarding it', async () => {
    const client = createOpenFhirClient()

    const mock = nock(FHIR_SERVER)
        .get('/QuestionnaireResponse/sykmelding-1')
        .reply(404, operationOutcome, { 'Content-Type': 'application/fhir+json' })

    const result = await client.request('QuestionnaireResponse/sykmelding-1', { expectNotFound: true })

    expect(mock.isDone()).toBe(true)
    expectHas(result, 'error')
    expectHas(result, 'operationOutcome')
    expect(result).toMatchObject({
        error: 'REQUEST_FAILED_RESOURCE_NOT_FOUND',
        operationOutcome,
    })
})
