import { SharedOtelAttributes } from '#internal-lib/otel'

/**
 * Span attributes used by `fhir.*` spans.
 */
export const FhirOtelAttributes = {
    ...SharedOtelAttributes,
    FhirFetch: 'fhir.fetch',
    FhirResource: 'fhir.resource',
    FhirResourceStatus: 'fhir.resource.status',
    ResourceCacheEnabled: 'fhir.resource.cache-enabled',
    ResourceCacheHit: 'fhir.resource.cache-hit',
    ResourceCacheUpdated: 'fhir.resource.cache-updated',
} as const
