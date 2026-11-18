import { FhirClient } from '#fhir/FhirClient'
import { FHIR_SERVER } from '#test-utils/mocks'

export function createOpenFhirClient(): FhirClient {
    return new FhirClient({
        fhirServer: FHIR_SERVER,
    })
}
