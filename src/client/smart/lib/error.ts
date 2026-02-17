import { type OperationOutcome, OperationOutcomeSchema } from '../../../zod/errors'

const status = (response: Response): string => `${response.status} ${response.statusText}`

export async function fhirResponseToFormattedError(response: Response): Promise<[Error, OperationOutcome | null]> {
    const contentType = response.headers.get('Content-Type')
    if (!contentType) {
        return [
            new Error(`Unknown error, ${status(response)} (content-type was: ${response.headers.get('Content-Type')})`),
            null,
        ]
    }

    const body = await response.text()
    if (contentType.includes('application/fhir+json')) {
        const { success, data } = OperationOutcomeSchema.safeParse(JSON.parse(body))
        if (success) {
            return [new Error(formatOperationOutcome(data), { cause: JSON.stringify(data, null, 2) }), data]
        }
    } else if (contentType.includes('application/json')) {
        try {
            const json = JSON.parse(body)
            return [new Error(JSON.stringify(json, null, 2)), null]
        } catch {
            // Just return the text
            return [new Error(body), null]
        }
    }

    // For other content types, return raw text as cause
    return [
        new Error(
            `Unknown content-type on error, ${status(response)}, (content-type was: ${response.headers.get('Content-Type')})`,
            { cause: new Error(body) },
        ),
        null,
    ]
}

export function formatOperationOutcome(operationOutcome: OperationOutcome): string {
    const issues = operationOutcome.issue.map((it) => `${it.severity} (${it.code}): ${it.diagnostics}`)

    return `FHIR OperationOutcome: ${issues.join('\n')}`
}

export function operationOutcomeToError(operationOutcome: OperationOutcome): Error {
    const message = formatOperationOutcome(operationOutcome)

    return new Error(message, { cause: new Error(JSON.stringify(operationOutcome, null, 2)) })
}
