import { expect, test } from 'vitest'

import type { CompleteSession } from '../../client/storage/schema'
import type { FhirDocumentReference, FhirQuestionaireResponse } from '../../zod'
import { mockUpdateDocumentReference } from '../mocks/create-resources'
import { createLaunchedOpenReadyClient } from '../utils/client-open'
import { expectHas } from '../utils/expect'
import { createTestIdToken } from '../utils/token'

test('SmartClient.create - /DocumentReference with QuestionaireResponse as base64 payload', async () => {
    const [ready] = await createLaunchedOpenReadyClient(validSession)

    const documentReferencePayloadWithQuestionnaire: Omit<FhirDocumentReference, 'id'> = {
        resourceType: 'DocumentReference',
        status: 'completed',
        meta: { lastUpdated: new Date().toISOString() },
        type: {
            coding: [
                {
                    system: 'urn:oid:2.16.578.1.12.4.1.1.9602',
                    code: 'J01-2',
                    display: 'Sykmeldinger og trygdesaker',
                },
            ],
        },
        subject: { reference: `Patient/48791875-45c0-4468-ab4a-4393c7573047` },
        author: [{ reference: `Practitioner/c5d0fd78-0e2d-49ef-ab31-b40c975b5a8f` }],
        context: { encounter: [{ reference: `Encounter/483fbd7b-08c4-4c42-af18-2c273b8eb4de` }] },
        content: [
            {
                attachment: {
                    title: 'This is my PDF!',
                    language: 'no',
                    contentType: 'application/pdf',
                    data: 'JVBERi0xLjQK',
                },
            },
            {
                attachment: {
                    title: 'This is my JSON!',
                    language: 'no',
                    contentType: 'application/fhir+json',
                    data: Buffer.from(
                        JSON.stringify({
                            resourceType: 'QuestionnaireResponse',
                            id: '364afc84-659a-46bb-b3b4-6c03054a965a',
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
                        } satisfies FhirQuestionaireResponse),
                        'base64',
                    ).toString('utf-8'),
                },
            },
        ],
    }

    const mock = mockUpdateDocumentReference({
        expectedId: 'min-kule-sykmelding-id',
        expectedPayload: documentReferencePayloadWithQuestionnaire,
        onSuccess: {
            id: 'min-kule-sykmelding-id',
            ...documentReferencePayloadWithQuestionnaire,
        } satisfies FhirDocumentReference,
    })

    const documentReference = await ready.update('DocumentReference', {
        id: 'min-kule-sykmelding-id',
        payload: documentReferencePayloadWithQuestionnaire,
    })

    if ('error' in documentReference) {
        // Verify union types, this should be string, not unknown
        expect(documentReference.error.toString()).not.toBeNull()
    }

    expect(mock.isDone()).toBe(true)
    expectHas(documentReference, 'resourceType')

    expect(documentReference.resourceType).toBe('DocumentReference')
    expect(documentReference.content[0].attachment.contentType).toEqual('application/pdf')
    expect(documentReference.content[1].attachment.contentType).toEqual('application/fhir+json')
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
