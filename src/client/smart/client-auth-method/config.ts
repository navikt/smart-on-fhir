type ConfidentialSymmetricMethod =
    | {
          method: 'client_secret_post'
          clientSecret: string
      }
    | {
          method: 'client_secret_basic'
          clientSecret: string
      }
/**
 * Consider implementing support for private_key_jwt in the future.
 *
 * For example:
 * | {
 *      auth: 'private_key_jwt'
 *      privateKey: string
 *   }
 */

type SmartConfidentialSymmetricMode = {
    type: 'confidential-symmetric'
} & ConfidentialSymmetricMethod

type SmartPublicMode = {
    type: 'public'
}

export type FhirAuthMode = SmartPublicMode | SmartConfidentialSymmetricMode

export type KnownFhirServer = {
    /**
     * A human readable name for the FHIR server
     */
    name: string
    /**
     * Expected issuer URL the app will be launched against
     */
    issuer: string
} & FhirAuthMode
