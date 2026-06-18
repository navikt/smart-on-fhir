type ConfidentialSymmetricMethod =
    | {
          method: 'client_secret_post'
          clientSecret: string
      }
    | {
          method: 'client_secret_basic'
          clientSecret: string
      }

type ConfidentialAsymmetricMethod = {
    method: 'private_key_jwt'
    /**
     * The client's private key as a JWK (JSON Web Key) JSON string.
     *
     * Must include `alg` and `kid`, which are used to sign and identify the
     * client assertion JWT. The `alg` must be one the authorization server
     * accepts for token endpoint authentication; SMART requires support for
     * `RS384` and `ES384` as a baseline. The matching public key must be
     * registered with the authorization server.
     */
    privateKey: string
}

type SmartConfidentialSymmetricMode = {
    type: 'confidential-symmetric'
} & ConfidentialSymmetricMethod

type SmartConfidentialAsymmetricMode = {
    type: 'confidential-asymmetric'
} & ConfidentialAsymmetricMethod

type SmartPublicMode = {
    type: 'public'
}

export type FhirAuthMode = SmartPublicMode | SmartConfidentialSymmetricMode | SmartConfidentialAsymmetricMode

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
