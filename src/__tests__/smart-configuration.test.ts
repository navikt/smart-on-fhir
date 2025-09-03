import { test } from 'vitest'

import { fetchSmartConfiguration } from '../client/smart/well-known/smart-configuration'
import { clearSmartConfigurationCache } from '../client/smart/well-known/smart-configuration-cache'

import { FHIR_SERVER } from './mocks/common'
import { mockSmartConfiguration } from './mocks/issuer'
import { expectHas } from './utils/expect'

test('should cache smart configuration', async () => {
    mockSmartConfiguration()

    // First fetch works
    expectHas(await fetchSmartConfiguration(FHIR_SERVER), 'issuer')
    // Second fetch hits cache
    expectHas(await fetchSmartConfiguration(FHIR_SERVER), 'issuer')

    // Third fails because its no longer cached and hits the network (which is not nocked anymore)
    clearSmartConfigurationCache()
    expectHas(await fetchSmartConfiguration(FHIR_SERVER), 'error')
})
