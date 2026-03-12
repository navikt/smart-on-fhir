import { expect, test } from 'vitest'

import type { CompleteSession } from '../../client/storage/schema'
import type { FhirQuestionnaireResponse } from '../../zod'
import { mockUpdateQuestionnaireResponse } from '../mocks/create-resources'
import { createLaunchedOpenReadyClient } from '../utils/client-open'
import { expectHas } from '../utils/expect'
import { createTestIdToken } from '../utils/token'

test('SmartClient.create - /DocumentReference with QuestionnaireResponse as base64 payload', async () => {
    const [ready] = await createLaunchedOpenReadyClient(validSession)

    const questionnaireResponsePayload: Omit<FhirQuestionnaireResponse, 'id'> = {
        resourceType: 'QuestionnaireResponse',
        status: 'completed',
        item: [
            {
                linkId: '1',
                text: 'I hvilken periode er du sykmeldt fra?',
                item: [
                    {
                        linkId: '1.1',
                        text: 'Sykmeldt fra',
                        answer: [{ valueDateTime: '2024-01-01T02:30:00Z' }],
                    },
                    {
                        linkId: '1.2',
                        text: 'Sykmeldt til',
                        answer: [{ valueDateTime: '2024-01-01T07:45:00Z' }],
                    },
                ],
            },
        ],
        subject: { reference: 'Patient/ba6dd550-f2a0-47d2-a478-0277a0eb50fb' },
        encounter: { reference: 'Encounter/8e119d9b-254e-465a-8c84-b14fe7cc9727' },
        author: { reference: 'Practitioner/fc6fceb7-170c-41da-9b96-0b71976da949' },
    }

    const mock = mockUpdateQuestionnaireResponse({
        expectedId: 'min-kule-sykmelding-id',
        expectedPayload: questionnaireResponsePayload,
        onSuccess: {
            id: 'min-kule-sykmelding-id',
            ...questionnaireResponsePayload,
        } satisfies FhirQuestionnaireResponse,
    })

    const questionnaireResponse = await ready.update('QuestionnaireResponse', {
        id: 'min-kule-sykmelding-id',
        payload: questionnaireResponsePayload,
    })

    if ('error' in questionnaireResponse) {
        // Verify union types, this should be string, not unknown
        expect(questionnaireResponse.error.toString()).not.toBeNull()
    }

    expect(mock.isDone()).toBe(true)
    expectHas(questionnaireResponse, 'resourceType')

    expect(questionnaireResponse.resourceType).toBe('QuestionnaireResponse')
    expect(questionnaireResponse.item[0].text).toEqual('I hvilken periode er du sykmeldt fra?')
})

const validSession: CompleteSession = {
    // Initial
    server: 'http://fhir-server',
    issuer: 'http://fhir-auth-server',
    authorizationEndpoint: 'http://fhir-auth-server/authorize',
    tokenEndpoint: 'http://fhir-auth-server/token',
    codeVerifier: 'valid-code-verifier',
    state: 'valid-state',
    // Completed
    accessToken: 'valid-access-token',
    idToken: await createTestIdToken({
        fhirUser: 'Practitioner/ac768edb-d56a-4304-8574-f866c6af4e7e',
    }),
    refreshToken: 'valid-refresh-token',
    patient: 'valid-patient-id',
    encounter: 'valid-encounter-id',
}
