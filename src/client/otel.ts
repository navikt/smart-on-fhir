import { type Span, trace, context, SpanStatusCode } from '@opentelemetry/api'
import { logger } from './logger'

const LIB_NAME = '@navikt/smart-on-fhir'
const LIB_VERSION = '0.0.1-alpha.0'
const SPAN_PREFIX = 'SmartClient.'

export async function spanAsync<Result>(name: string, fn: (span: Span) => Promise<Result>): Promise<Result> {
    const tracer = trace.getTracer(LIB_NAME, LIB_VERSION)
    const span = tracer.startSpan(`${SPAN_PREFIX}${name}`)

    return context.with(trace.setSpan(context.active(), span), async () => fn(span).finally(() => span.end()))
}

export function spanSync<Result>(name: string, fn: () => Result): Result {
    const tracer = trace.getTracer(LIB_NAME, LIB_VERSION)
    const span = tracer.startSpan(`${SPAN_PREFIX}${name}`)

    return context.with(trace.setSpan(context.active(), span), () => {
        try {
            return fn()
        } finally {
            span.end()
        }
    })
}

/**
 * Marks the span as failed, as well as logs the exception.
 */
export function failSpan(span: Span, error: Error): void {
    logger.error(error)

    span.recordException(error)
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
}

export const OtelTaxonomy = {
    FhirServer: 'fhir.server',
    FhirResource: 'fhir.resource',
    SessionExpired: 'session.expired',
    SessionError: 'session.error',
    SessionRefreshed: 'session.refreshed',
}
