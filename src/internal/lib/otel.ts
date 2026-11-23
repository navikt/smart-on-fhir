import { logger as pinoLogger } from '@navikt/pino-logger'
import { context, type Span, type Attributes, SpanStatusCode, trace, type Tracer } from '@opentelemetry/api'
import { suppressTracing } from '@opentelemetry/core'

export type { Span }

export const otelLogger = pinoLogger.child({}, { msgPrefix: '[SoF Otel] ' })

const LIB_NAME = '@navikt/smart-on-fhir'

/**
 * The part of the library a span originates from. Used both as the span name prefix
 * (e.g. `fhir.read.Patient`) and as the instrumentation scope (e.g. `@navikt/smart-on-fhir/fhir`).
 */
export type TracingScope = 'smart' | 'fhir' | 'http'

export type Tracing = {
    spanAsync: <Result>(name: string, fn: (span: Span) => Promise<Result>) => Promise<Result>
    spanSync: <Result>(name: string, fn: (span: Span) => Result) => Result
}

/**
 * Creates span helpers bound to a specific part of the library.
 *
 * Span name convention: `<scope>.<component>.<operation>`, dot-separated segments in kebab-case,
 * except FHIR resource types which keep their spec capitalization (e.g. `fhir.read.DocumentReference`).
 */
export function createTracing(scope: TracingScope): Tracing {
    const spanName = (name: string): string => `${scope}.${name}`
    const getTracer = (): Tracer => trace.getTracer(`${LIB_NAME}/${scope}`, LIB_VERSION)

    return {
        spanAsync: async (name, fn) => {
            const span = getTracer().startSpan(spanName(name))
            return context.with(trace.setSpan(context.active(), span), async () => fn(span).finally(() => span.end()))
        },
        spanSync: (name, fn) => {
            const span = getTracer().startSpan(spanName(name))
            return context.with(trace.setSpan(context.active(), span), () => {
                try {
                    return fn(span)
                } finally {
                    span.end()
                }
            })
        },
    }
}

export async function squelchTracing<Result>(fn: () => Promise<Result>): Promise<Result> {
    return context.with(suppressTracing(context.active()), () => fn())
}

/**
 * Marks the span as failed, as well as logs the exception.
 */
export function failSpan(span: Span, what: string): void
export function failSpan(span: Span, what: string, error: unknown): void
export function failSpan(span: Span, what: string, error: unknown, attrs?: Attributes): void
export function failSpan(span: Span, what: string, error?: unknown, attrs?: Attributes): void {
    otelLogger.error(new Error(what, { cause: error }))

    if (attrs) span.setAttributes(attrs)

    if (error && error instanceof Error) {
        span.recordException(error)
        // OTEL does not support `cause`, but multiple recordException will create multiple events on the span
        if (error.cause != null) {
            span.recordException(error.cause instanceof Error ? error.cause : new Error(error.cause as string))
        }
    }

    span.setStatus({ code: SpanStatusCode.ERROR, message: what })
}

export const SharedOtelAttributes = {
    FhirServer: 'fhir.server',
} as const
