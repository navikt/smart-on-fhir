import { test } from 'vitest'

import { expectHas } from '../internal/test-utils/expect'
import { FHIR_SERVER } from '../internal/test-utils/mocks/common'
import { mockSmartConfiguration } from '../internal/test-utils/mocks/issuer'
import { getSmartConfiguration } from '../smart/launch/well-known/smart-configuration'
import { clearSmartConfigurationCache } from '../smart/launch/well-known/smart-configuration-cache'

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
