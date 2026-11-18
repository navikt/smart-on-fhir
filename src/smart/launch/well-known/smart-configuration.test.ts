import { test } from 'vitest'

import { clearSmartConfigurationCache } from '#smart/launch/well-known/smart-configuration-cache'
import { expectHas } from '#test-utils/expect'
import { FHIR_SERVER } from '#test-utils/mocks'
import { mockSmartConfiguration } from '#test-utils/mocks'

import { getSmartConfiguration } from './smart-configuration'

test('should cache smart configuration', async () => {
    mockSmartConfiguration()

    // First fetch hits the nocked network and caches the result
    expectHas(await getSmartConfiguration(FHIR_SERVER), 'issuer')
    // Second request hits the cache
    expectHas(await getSmartConfiguration(FHIR_SERVER), 'issuer')

    clearSmartConfigurationCache()

    // Third fails because its no longer cached and hits the network (which is not nocked anymore)
    expectHas(await getSmartConfiguration(FHIR_SERVER), 'error')
})
