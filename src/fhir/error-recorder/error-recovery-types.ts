import type { PutFhirResourceIdentifier, PutPostFhirPayload } from '#fhir/fhir-fetch'
import type { KnownCreatePaths } from '#fhir/resources/create-resource-map'
import type { OperationOutcome } from '#zod'

export type RecoverableRequests =
    | {
          method: 'PUT'
          resource: PutFhirResourceIdentifier
          payload: PutPostFhirPayload
          error: OperationOutcome | Error
      }
    | {
          method: 'POST'
          path: KnownCreatePaths
          payload: PutPostFhirPayload
          error: OperationOutcome | Error
      }
