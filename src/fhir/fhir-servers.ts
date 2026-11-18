export type AuthenticatedServer = {
    fhirServer: string
    accessToken: string
}

export type OpenServer = {
    fhirServer: string
}

export type FhirServer = AuthenticatedServer | OpenServer
