import nock from 'nock'
import { beforeEach, vi } from 'vitest'

beforeEach(() => {
    nock.cleanAll()
})

const isIntellijRunner = process.env._JETBRAINS_VITEST_REPORTER_ABSOLUTE_PATH != null
if (!isIntellijRunner) {
    // Suppress all logging during tests. comment this line to enable logging.
    vi.mock('@navikt/pino-logger', () => {
        const loggerMock = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
            fatal: vi.fn(),
            trace: vi.fn(),
            child: () => loggerMock,
        }

        return { logger: loggerMock }
    })
}
