type ResourceResult = Record<string, unknown> | { error: string }

type MultiInput = Record<string, Promise<ResourceResult>>

type ErrorOf<T> = Extract<Awaited<T>, { error: string }>

type SuccessOf<T> = Exclude<Awaited<T>, { error: string }>

type MultiSuccess<Input extends MultiInput> = {
    readonly ok: true
} & {
    readonly [K in keyof Input]: SuccessOf<Input[K]>
}

type MultiFailure<Input extends MultiInput> = {
    readonly ok: false
    /**
     * The keys of every resource that failed, in the order they were provided.
     */
    readonly failedResource: (keyof Input)[]
    /**
     * The collected error objects for every resource that failed, aligned with `failedResource`.
     */
    readonly errors: ErrorOf<Input[keyof Input]>[]
    /**
     * The full per-key result map, so you can inspect exactly which resources
     * succeeded and which failed without re-issuing requests.
     */
    readonly results: {
        readonly [K in keyof Input]: Awaited<Input[K]>
    }
}

export type MultiResult<Input extends MultiInput> = MultiSuccess<Input> | MultiFailure<Input>

/**
 * Load multiple FHIR resources in parallel, combining their (never-thrown) errors behind
 * the scenes into a single discriminated result.
 *
 * Pass a record of named resource requests. Every request runs concurrently. The result
 * is `ok: true` only when *all* requests succeeded, in which case every resource is
 * available by its key. If *any* request failed, the result is `ok: false` and carries
 * the failed keys, their errors, and the full result map.
 *
 * @example
 * const result = await multi({
 *     patient: ready.patient.request(),
 *     practitioner: ready.user.request(),
 * })
 *
 * if (!result.ok) {
 *     // result.failedResource: ('patient' | 'practitioner')[]
 *     // result.errors: ResourceRequestErrors[]
 *     return
 * }
 *
 * result.patient.resourceType // 'Patient'
 * result.practitioner.resourceType // 'Practitioner'
 */
export async function multi<const Input extends MultiInput>(input: Input): Promise<MultiResult<Input>> {
    const keys = Object.keys(input) as (keyof Input)[]
    const settled = await Promise.all(keys.map((key) => input[key]))

    const results = {} as { [K in keyof Input]: Awaited<Input[K]> }
    const failedResource: (keyof Input)[] = []
    const errors: ErrorOf<Input[keyof Input]>[] = []

    keys.forEach((key, index) => {
        const result = settled[index]
        results[key] = result as Awaited<Input[typeof key]>

        if (isError(result)) {
            failedResource.push(key)
            errors.push(result as ErrorOf<Input[keyof Input]>)
        }
    })

    if (failedResource.length > 0) {
        return { ok: false, failedResource, errors, results }
    }

    return { ok: true, ...(results as { [K in keyof Input]: SuccessOf<Input[K]> }) }
}

function isError(result: ResourceResult): result is { error: string } {
    return 'error' in result
}
