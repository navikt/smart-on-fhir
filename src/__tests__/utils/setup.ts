import nock from 'nock'
import { beforeEach, vi } from 'vitest'

import { clearSmartConfigurationCache } from '../../client/smart/well-known/smart-configuration-cache'

beforeEach(() => {
    clearSmartConfigurationCache()
    nock.cleanAll()
})
