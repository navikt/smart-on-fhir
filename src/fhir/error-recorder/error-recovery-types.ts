import type { PayloadForCreate } from '#fhir/resources/create-resource-map'
import type { OperationOutcome } from '#zod'

type RecoverableRequestErrorDetails = {
    message: string
    stack: string | null
    operationOutcome: OperationOutcome | null
}

export type NewRecoverableRequest = Omit<RecoverableRequest, 'recordedAt' | 'attempts' | 'error'> & {
    operationOutcome: OperationOutcome | null
    error: Error
}

export type RecoverableRequest = {
    method: 'POST' | 'PUT'
    path: string
    payload: PayloadForCreate<'DocumentReference'> | PayloadForCreate<'QuestionnaireResponse'>
    error: RecoverableRequestErrorDetails
    // hmm.. part of session?
    fhirServer: string
    recordedAt: string
    attempts: number
}
