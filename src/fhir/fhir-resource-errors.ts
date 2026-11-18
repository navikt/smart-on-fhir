import type { OperationOutcome, FhirBatchResponseBundle } from '#zod'

export type ResourceCreateErrors = {
    error: 'CREATE_FAILED_NON_OK_RESPONSE' | 'CREATE_FAILED_INVALID_RESPONSE' | 'CREATE_FAILED_NOT_SUPPORTED'
    operationOutcome?: OperationOutcome | null
}

export type ResourceBatchErrors =
    | {
          error: 'BATCH_FAILED_SOME_OK' | 'BATCH_FAILED_ALL_FAILED'
          result?: FhirBatchResponseBundle
      }
    | {
          error: 'BATCH_FAILED_INVALID_RESPONSE' | 'BATCH_FAILED_NON_OK_RESPONSE'
          operationOutcome?: OperationOutcome | null
      }

export type ResourceRequestErrors = {
    error: 'REQUEST_FAILED_NON_OK_RESPONSE' | 'REQUEST_FAILED_INVALID_RESPONSE' | 'REQUEST_FAILED_RESOURCE_NOT_FOUND'
    operationOutcome?: OperationOutcome | null
}
