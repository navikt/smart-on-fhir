import { createTracing } from './otel'

const { spanAsync } = createTracing('http')

const INITIAL_DELAY = 10
const DELAY_FACTOR = 5
const MAX_DELAY = 1500

/**
 * With delay factor of 5:
 * * 1st attempt: 10ms
 * * 2nd attempt: 50ms
 * * 3rd attempt: 250ms
 * * 4th attempt: 1250ms
 * * 5th attempt: 1500ms (capped at max delay)
 */
function getDelay(attempt: number): number {
    return Math.min(INITIAL_DELAY * Math.pow(DELAY_FACTOR, attempt - 1), MAX_DELAY)
}

type FetchWithRetry = {
    maxAttempts: number
}

/**
 * Wraps normal fetch with a simple retry-mechanism with a exponential backoff.
 *
 * On continued failure, the last response is returned after the maximum number of retries are exhausted.
 *
 * Normal fetch throw rules apply.
 */
export function configureFetchWithRetry(opts: FetchWithRetry = { maxAttempts: 5 }) {
    return (...args: Parameters<typeof fetch>): Promise<Response> => {
        const doFetch = async (attempt: number): Promise<Response> =>
            spanAsync('fetch-with-retry', async (span) => {
                span.setAttributes({
                    'retry.maxRetries': opts.maxAttempts,
                    'retry.attempt': attempt,
                })

                const response = await fetch(...args)

                if (!response.ok && attempt < opts.maxAttempts) {
                    span.setAttributes({
                        'retry.status': response.status,
                        'retry.statusText': response.statusText,
                    })

                    await new Promise((resolve) => setTimeout(resolve, getDelay(attempt)))
                    return doFetch(attempt + 1)
                }

                return response
            })

        return doFetch(1)
    }
}

/**
 * Converts a non-OK response into a human-readable error message, attempting to parse FHIR OperationOutcome if possible.
 */
export async function responseToError(response: Response): Promise<Error> {
    const contentType = response.headers.get('Content-Type')
    if (!contentType) {
        return Error(`HTTP error - ${status(response)} (without content-type)`)
    }

    if (contentType.includes('application/json')) {
        const json = await response.text()
        return Error(`HTTP error with JSON body - ${status(response)}, server says: ${json}`)
    }

    const text = await response.text()
    return Error(`HTTP error with text body - ${status(response)}, server says: ${text}`)
}

export const status = (response: Response): string => `${response.status} ${response.statusText}`
