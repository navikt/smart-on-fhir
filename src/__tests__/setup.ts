import { logger } from '@navikt/pino-logger'
import nock from 'nock'
import { beforeEach } from 'vitest'

beforeEach(() => {
    nock.cleanAll()
})

const isIntellijRunner = process.env._JETBRAINS_VITEST_REPORTER_ABSOLUTE_PATH != null
if (!isIntellijRunner) {
    // Suppress all logging during tests. comment this line to enable logging.
    logger.level = 'silent'
}
