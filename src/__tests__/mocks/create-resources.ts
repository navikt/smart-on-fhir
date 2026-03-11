import nock, { type RequestBodyMatcher, type Scope } from 'nock'

import type { PayloadForCreate, ResponseForCreate } from '../../client/fhir/resources/create-resource-map'
import type { FhirDocumentReference } from '../../zod'

const createdDocumentReference: FhirDocumentReference = {
    resourceType: 'DocumentReference',
    id: 'aa66036d-b63c-4c5a-b3d5-b1d1f80000d',
    meta: {
        versionId: '1',
        lastUpdated: '2025-03-04T03:21:36.880-05:00',
    },
    status: 'current',
    type: {
        coding: [
            {
                system: 'urn:oid:2.16.578.1.12.4.1.1.9602',
                code: 'J01-2',
                display: 'Sykmeldinger og trygdesaker',
            },
        ],
    },
    subject: {
        reference: 'Patient/cd09f5d4-55f7-4a24-a25d-a5b65c7a8805',
    },
    author: [],
    content: [
        {
            attachment: {
                contentType: 'application/pdf',
                language: 'no',
                title: 'Sykmelding',
                data: 'osanetaonteuhnaoec',
            },
        },
    ],
    context: {
        encounter: [{ reference: 'Encounter/320fd29a-31b9-4c9f-963c-c6c88332d89a' }],
    },
}

export function mockCreateDocumentReference(
    expectedPayload: PayloadForCreate<'DocumentReference'>,
    onSuccess: FhirDocumentReference = createdDocumentReference,
): Scope {
    return nock('http://fhir-server')
        .post(`/DocumentReference`, expectedPayload as RequestBodyMatcher)
        .reply(200, onSuccess)
}

export function mockUpdateDocumentReference({
    expectedId,
    expectedPayload,
    onSuccess = createdDocumentReference,
}: {
    expectedId: string
    expectedPayload: PayloadForCreate<'DocumentReference'>
    onSuccess?: ResponseForCreate<'DocumentReference'>
}): Scope {
    return nock('http://fhir-server')
        .put(`/DocumentReference/${expectedId}`, expectedPayload as RequestBodyMatcher)
        .reply(200, onSuccess)
}

export function mockUpdateQuestionnaireResponse({
    expectedId,
    expectedPayload,
    onSuccess,
}: {
    expectedId: string
    expectedPayload: PayloadForCreate<'QuestionnaireResponse'>
    onSuccess: ResponseForCreate<'QuestionnaireResponse'>
}): Scope {
    return nock('http://fhir-server')
        .put(`/QuestionnaireResponse/${expectedId}`, expectedPayload as RequestBodyMatcher)
        .reply(200, onSuccess)
}
