import { logger as pinoLogger } from '@navikt/pino-logger'

export const smartLogger = pinoLogger.child({}, { msgPrefix: '[Smart Client] ' })
