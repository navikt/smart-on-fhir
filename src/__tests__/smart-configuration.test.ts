import { test } from 'vitest'

import { getSmartConfiguration } from '../client/smart/well-known/smart-configuration'
import { clearSmartConfigurationCache } from '../client/smart/well-known/smart-configuration-cache'

import { FHIR_SERVER } from './mocks/common'
import { mockSmartConfiguration } from './mocks/issuer'
import { expectHas } from './utils/expect'

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
