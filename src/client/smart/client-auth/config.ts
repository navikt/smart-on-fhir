export type ConfidentialSymmetricType =
    | {
          auth: 'client_secret_post'
          clientSecret: string
      }
    | {
          auth: 'client_secret_basic'
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

type SmartConfidentialSymmetric = {
    type: 'confidential-symmetric'
} & ConfidentialSymmetricType

type SmartPublicMode = {
    type: 'public'
}

export type FhirAuthMode = SmartPublicMode | SmartConfidentialSymmetric

export type KnownFhirServer = {
    issuer: string
} & FhirAuthMode
