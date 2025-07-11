import { createRemoteJWKSet } from 'jose'

import { logger } from '../../logger'
import { OtelTaxonomy, spanAsync } from '../../otel'
import { removeTrailingSlash } from '../../utils'

import type { SmartConfigurationErrors } from './smart-configuration-errors'
import { type SmartConfiguration, SmartConfigurationSchema } from './smart-configuration-schema'

export async function fetchSmartConfiguration(
    fhirServer: string,
): Promise<SmartConfiguration | SmartConfigurationErrors> {
    fhirServer = removeTrailingSlash(fhirServer)

    return spanAsync('smart-configuration', async (span) => {
        span.setAttribute(OtelTaxonomy.FhirServer, fhirServer)

        const smartConfigurationUrl = `${fhirServer}/.well-known/smart-configuration`
        logger.info(`Fetching smart-configuration from ${smartConfigurationUrl}`)

        try {
            const response = await fetch(smartConfigurationUrl)
            if (!response.ok) {
                logger.error(`FHIR Server responded with ${response.status} ${response.statusText}`)
                return { error: 'WELL_KNOWN_INVALID_RESPONSE' }
            }

            const result: unknown = await response.json()
            const validatedWellKnown = SmartConfigurationSchema.safeParse(result)
            if (!validatedWellKnown.success) {
                logger.error(
                    new Error(`FHIR Server ${fhirServer} responded with weird smart-configuration`, {
                        cause: validatedWellKnown.error,
                    }),
                )

                span.recordException(validatedWellKnown.error)

                return { error: 'WELL_KNOWN_INVALID_BODY' }
            }

            logger.info(`FHIR Server ${fhirServer} response validated`)
            return validatedWellKnown.data
        } catch (e) {
            logger.error(new Error('Fatal error fetching smart configuration', { cause: e }))

            if (e instanceof Error) span.recordException(e)

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
