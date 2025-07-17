type SmartClientBaseConfiguration = {
    client_id: string
    scope: string
    callback_url: string
    redirect_url: string
}

export type SmartClientConfiguration = SmartClientBaseConfiguration &
    (
        | {
              /**
               * Will allow launches to any FHIR server. You can use this if you want to handle your own
               * access control, or if the application is meant to be open.
               */
              allowAnyIssuer: true
          }
        | {
              knownFhirServers: KnownFhirServer[]
          }
    )

export type KnownFhirServer = {
    issuer: string
} & (
    | {
          type: 'public'
      }
    | {
          type: 'confidential-symmetric'
          clientSecret: string
      }
)

export type SmartClientOptions = {
    autoRefresh?: boolean
}
