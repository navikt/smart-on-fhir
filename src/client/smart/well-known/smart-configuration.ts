import { createRemoteJWKSet } from 'jose'

import { logger } from '../lib/logger'
import { failSpan, OtelTaxonomy, spanAsync } from '../lib/otel'
import { removeTrailingSlash } from '../lib/utils'

import { getCachedSmartConfiguration, setSmartConfigurationCache } from './smart-configuration-cache'
import type { SmartConfigurationErrors } from './smart-configuration-errors'
import { type SmartConfiguration, SmartConfigurationSchema } from './smart-configuration-schema'

export async function fetchSmartConfiguration(
    fhirServer: string,
): Promise<SmartConfiguration | SmartConfigurationErrors> {
    fhirServer = removeTrailingSlash(fhirServer)

    return spanAsync('smart-configuration', async (span) => {
        span.setAttribute(OtelTaxonomy.FhirServer, fhirServer)

        const cachedSmartConfig = getCachedSmartConfiguration(fhirServer)
        if (cachedSmartConfig) {
            span.setAttribute(OtelTaxonomy.SmartConfigurationCacheHit, true)
            return cachedSmartConfig
        }

        try {
            const smartConfigurationUrl = `${fhirServer}/.well-known/smart-configuration`
            const response = await fetch(smartConfigurationUrl)
            if (!response.ok) {
                logger.error(`FHIR Server responded with ${response.status} ${response.statusText}`)
                return { error: 'WELL_KNOWN_INVALID_RESPONSE' }
            }

            const result: unknown = await response.json()
            const validatedWellKnown = SmartConfigurationSchema.safeParse(result)
            if (!validatedWellKnown.success) {
                failSpan(
                    span,
                    `FHIR Server ${fhirServer} responded with weird smart-configuration`,
                    validatedWellKnown.error,
                )

                return { error: 'WELL_KNOWN_INVALID_BODY' }
            }

            setSmartConfigurationCache(fhirServer, validatedWellKnown.data)
            span.setAttribute(OtelTaxonomy.SmartConfigurationCacheHit, false)

            return validatedWellKnown.data
        } catch (e) {
            failSpan(span, 'Fatal error fetching smart configuration', e)

            return { error: 'UNKNOWN_ERROR' }
        }
    })
}

const remoteJWKSetCache: Record<string, ReturnType<typeof createRemoteJWKSet>> = {}
export function getJwkSet(jwksUri: string): ReturnType<typeof createRemoteJWKSet> {
    if (remoteJWKSetCache[jwksUri] == null) {
        remoteJWKSetCache[jwksUri] = createRemoteJWKSet(new URL(jwksUri))
    }

    return remoteJWKSetCache[jwksUri]
}
