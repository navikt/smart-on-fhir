import { configureFetchWithRetry } from '#internal-lib/fetch'
import { createTracing, failSpan } from '#internal-lib/otel'
import { removeTrailingSlash } from '#internal-lib/utils'

import { logger } from '../../logger'
import { SmartOtelAttributes } from '../../smart-otel'

import { getCachedSmartConfiguration, setSmartConfigurationCache } from './smart-configuration-cache'
import type { SmartConfigurationErrors } from './smart-configuration-errors'
import { type SmartConfiguration, SmartConfigurationSchema } from './smart-configuration-schema'

const { spanAsync } = createTracing('smart')

const fetchWithRetry = configureFetchWithRetry({ maxAttempts: 5 })

export async function getSmartConfiguration(
    fhirServer: string,
): Promise<SmartConfiguration | SmartConfigurationErrors> {
    fhirServer = removeTrailingSlash(fhirServer)

    return spanAsync('well-known.smart-configuration', async (span) => {
        span.setAttribute(SmartOtelAttributes.FhirServer, fhirServer)

        const cachedSmartConfig = getCachedSmartConfiguration(fhirServer)
        if (cachedSmartConfig) {
            span.setAttribute(SmartOtelAttributes.SmartConfigurationCacheHit, true)
            return cachedSmartConfig
        }

        try {
            const smartConfigurationUrl = `${fhirServer}/.well-known/smart-configuration`
            const response = await fetchWithRetry(smartConfigurationUrl)
            if (!response.ok) {
                logger.error(`FHIR Server responded with ${response.status} ${response.statusText}`)
                return { error: 'WELL_KNOWN_INVALID_RESPONSE' }
            }

            const result: unknown = await response.json()
            const validatedWellKnown = SmartConfigurationSchema.loose().safeParse(result)
            if (!validatedWellKnown.success) {
                failSpan(
                    span,
                    `FHIR Server ${fhirServer} responded with weird smart-configuration`,
                    validatedWellKnown.error,
                )

                return { error: 'WELL_KNOWN_INVALID_BODY' }
            }

            setSmartConfigurationCache(fhirServer, validatedWellKnown.data)
            span.setAttribute(SmartOtelAttributes.SmartConfigurationCacheHit, false)

            return validatedWellKnown.data
        } catch (e) {
            failSpan(span, 'Fatal error fetching smart configuration', e)

            return { error: 'UNKNOWN_ERROR' }
        }
    })
}
