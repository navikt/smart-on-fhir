import { expect, test } from 'vitest'

import type { FhirQuestionnaireResponse } from '../../zod'
import { mockUpdateQuestionnaireResponse } from '../mocks/create-resources'
import { createLaunchedOpenReadyClient, validExampleSession } from '../utils/client-open'
import { expectHas } from '../utils/expect'

test('SmartClient.create - /DocumentReference with QuestionnaireResponse as base64 payload', async () => {
    const [ready] = await createLaunchedOpenReadyClient(validExampleSession)

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
        throw Error(
            `Expected QuestionnaireResponse to be successful, but got error: ${questionnaireResponse.error.toString()}`,
        )
    }

    expect(mock.isDone()).toBe(true)
    expectHas(questionnaireResponse, 'resourceType')

    expect(questionnaireResponse.resourceType).toBe('QuestionnaireResponse')
    expect(questionnaireResponse.item[0].text).toEqual('I hvilken periode er du sykmeldt fra?')
})
