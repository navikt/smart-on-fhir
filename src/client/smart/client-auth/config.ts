export type ConfidentialSymmetricMethod =
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

export type SmartConfidentialSymmetricMode = {
    type: 'confidential-symmetric'
} & ConfidentialSymmetricMethod

export type SmartPublicMode = {
    type: 'public'
}

export type FhirAuthMode = SmartPublicMode | SmartConfidentialSymmetricMode

export type KnownFhirServer = {
    issuer: string
} & FhirAuthMode
