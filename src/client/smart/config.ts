import type { KnownFhirServer } from './client-auth/config'

type SmartClientBaseConfiguration = {
    client_id: string
    scope: string
    callback_url: string
    redirect_url: string
}

type OpenSmartClientConfiguration = {
    /**
     * Will allow launches to any FHIR server. You can use this if you want to handle your own
     * access control, or if the application is meant to be open.
     */
    allowAnyIssuer: true
}

export type ClosedSmartClientConfiguration = {
    /**
     * Only this list of known FHIR servers will be allowed to launch the application, using their appropirate
     * authentication methods.
     */
    knownFhirServers: KnownFhirServer[]
}

export type SmartClientConfiguration = SmartClientBaseConfiguration &
    (OpenSmartClientConfiguration | ClosedSmartClientConfiguration)

export type SmartClientOptions = {
    autoRefresh?: boolean
}
