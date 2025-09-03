import { context, type Span, SpanStatusCode, trace } from '@opentelemetry/api'
import { suppressTracing } from '@opentelemetry/core'

import { logger } from './logger'

export type { Span }

const LIB_NAME = '@navikt/smart-on-fhir'
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

export async function squelchTracing<Result>(fn: () => Promise<Result>): Promise<Result> {
    return context.with(suppressTracing(context.active()), () => fn())
}

/**
 * Marks the span as failed, as well as logs the exception.
 */
export function failSpan(span: Span, what: string): void
export function failSpan(span: Span, what: string, error: Error | unknown): void
export function failSpan(span: Span, what: string, error?: Error | unknown): void {
    logger.error(new Error(what, { cause: error }))

    if (error && error instanceof Error) {
        span.recordException(error)
        // OTEL does not support `cause`, but multiple recordException will create multiple events on the span
        if (error.cause != null) {
            span.recordException(error.cause instanceof Error ? error.cause : new Error(error.cause as string))
        }
    }

    span.setStatus({ code: SpanStatusCode.ERROR, message: what })
}

export const OtelTaxonomy = {
    FhirServer: 'fhir.server',
    FhirResource: 'fhir.resource',
    FhirResourceStatus: 'fhir.resource.status',
    FhirAuthorizationType: 'fhir.auth-type',
    SmartConfigurationCacheHit: 'fhir.smart-configuration.cache-hit',
    SessionExpired: 'session.expired',
    SessionError: 'session.error',
    SessionRefreshed: 'session.refreshed',
    SessionMulti: 'session.multi-launch',
}
