import { isDeepStrictEqual } from 'node:util'
import type * as z from 'zod'

import { ReadyClient } from '../client'
import type { SmartClient } from '../client'
import type { Validation } from '../client'
import type {
    KnownCreatePaths,
    PayloadForCreate,
    ResponseForCreate,
} from '../client/fhir/resources/create-resource-map'
import type { KnownPaths, ResponseFor } from '../client/fhir/resources/resource-map'
import type {
    ClaimErrors,
    ResourceBatchErrors,
    ResourceCreateErrors,
    ResourceRequestErrors,
} from '../client/smart/types/client-errors'
import type { CompleteSession } from '../client/storage/schema'
import type { FhirBatchBundle, FhirBatchResponseBundle } from '../zod'

type ReadResourceType = Exclude<ResponseFor<KnownPaths>['resourceType'], 'Bundle'>
type ReadResource<Type extends ReadResourceType> = ResponseFor<`${Type}/${string}`>
type SearchResult = ResponseFor<`Condition?${string}`>

type Stub = {
    method: 'GET' | 'POST' | 'PUT'
    path: string
    payload?: unknown
    matchPayload: boolean
    result: unknown
    remaining: number
}

/** Configure a reply before calling the mocked client. Replies are consumed once unless configured otherwise. */
export class ReplyBuilder<Success, Failure, Payload = never> {
    private expectedPayload?: Payload
    private matchPayload = false
    private count = 1
    private stub?: Stub

    constructor(
        private readonly stubs: Stub[],
        private readonly method: Stub['method'],
        private readonly path: string,
    ) {}

    /** Match a write's payload as well as its method and path. */
    withPayload(payload: Payload): this {
        this.expectedPayload = payload
        this.matchPayload = true
        if (this.stub) {
            this.stub.payload = payload
            this.stub.matchPayload = true
        }
        return this
    }

    times(count: number): this {
        if (!Number.isSafeInteger(count) || count < 1) throw new Error('times() requires a positive integer')
        this.count = count
        if (this.stub) this.stub.remaining = count
        return this
    }

    persist(): this {
        this.count = Infinity
        if (this.stub) this.stub.remaining = Infinity
        return this
    }

    reply(result: Success | Failure): this {
        if (this.stub) throw new Error(`Reply already configured for ${this.method} ${this.path}`)
        this.stub = {
            method: this.method,
            path: this.path,
            payload: this.expectedPayload,
            matchPayload: this.matchPayload,
            result,
            remaining: this.count,
        }
        this.stubs.push(this.stub)
        return this
    }

    replyError(error: Failure): this {
        return this.reply(error)
    }
}

export class RequestReplyBuilder<Success> extends ReplyBuilder<Success, ResourceRequestErrors> {
    replyNotFound(): this {
        return this.reply({ error: 'REQUEST_FAILED_RESOURCE_NOT_FOUND' })
    }
}

type ResourceBuilder<Type extends ReadResourceType> = {
    get(id: string): RequestReplyBuilder<ReadResource<Type>>
}

type ConditionBuilder = {
    search(query: string | URLSearchParams): RequestReplyBuilder<SearchResult>
}

export type MockReadyClientOptions = {
    patientId: string
    encounterId: string
    userId: string
    issuerName?: string
    claims?: Record<string, string | Record<string, unknown>>
    valid?: boolean
    validationReport?: Validation[]
}

/** A strictly matched in-memory ReadyClient, assignable to the real client type. */
export class MockReadyClient extends ReadyClient {
    private readonly stubs: Stub[] = []
    private readonly options: MockReadyClientOptions

    constructor(options: MockReadyClientOptions) {
        // ReadyClient's constructor only reads options.cache and decodes the ID token.
        // All public methods that use the synthetic session/client are overridden below.
        const client = { options: { cache: {} } } as SmartClient
        const session = {
            patient: options.patientId,
            encounter: options.encounterId,
            idToken: `e30.${Buffer.from(JSON.stringify({ fhirUser: `Practitioner/${options.userId}` })).toString('base64url')}.e30`,
        } as CompleteSession
        super(client, session, options.issuerName ?? 'Mock issuer')
        this.options = options
    }

    get patient(): ReadyClient['patient'] {
        const id = this.options.patientId
        return {
            type: 'Patient',
            id,
            reference: `Patient/${id}`,
            request: (config) => this.request(`Patient/${id}`, config),
        }
    }

    get encounter(): ReadyClient['encounter'] {
        const id = this.options.encounterId
        return {
            type: 'Encounter',
            id,
            reference: `Encounter/${id}`,
            request: (config) => this.request(`Encounter/${id}`, config),
        }
    }

    get user(): ReadyClient['user'] {
        const id = this.options.userId
        return {
            type: 'Practitioner',
            id,
            fhirUser: `Practitioner/${id}`,
            request: (config) => this.request(`Practitioner/${id}`, config),
        }
    }

    on(type: 'Condition'): ConditionBuilder
    on<Type extends ReadResourceType>(type: Type): ResourceBuilder<Type>
    on(type: ReadResourceType | 'Condition'): ResourceBuilder<ReadResourceType> | ConditionBuilder {
        if (type === 'Condition') {
            return {
                search: (query) =>
                    new RequestReplyBuilder<SearchResult>(
                        this.stubs,
                        'GET',
                        `Condition?${String(query).replace(/^\?/, '')}`,
                    ),
            }
        }
        return {
            get: (id) => new RequestReplyBuilder<ReadResource<ReadResourceType>>(this.stubs, 'GET', `${type}/${id}`),
        }
    }

    onCreate<Type extends KnownCreatePaths>(
        type: Type,
    ): ReplyBuilder<ResponseForCreate<Type>, ResourceCreateErrors, PayloadForCreate<Type>> {
        return new ReplyBuilder(this.stubs, 'POST', type)
    }

    onUpdate<Type extends KnownCreatePaths>(
        type: Type,
        id: string,
    ): ReplyBuilder<ResponseForCreate<Type>, ResourceCreateErrors, PayloadForCreate<Type>> {
        return new ReplyBuilder(this.stubs, 'PUT', `${type}/${id}`)
    }

    onBatch(
        type: 'batch' | 'transaction',
    ): ReplyBuilder<FhirBatchResponseBundle, ResourceBatchErrors, FhirBatchBundle['entry']> {
        return new ReplyBuilder(this.stubs, 'POST', `Bundle/${type}`)
    }

    async request<Path extends KnownPaths>(
        resource: Path,
        _config?: { cache?: { ttl: number }; expectNotFound?: true },
    ): Promise<ResponseFor<Path> | ResourceRequestErrors> {
        return this.consume('GET', resource) as ResponseFor<Path> | ResourceRequestErrors
    }

    async create<Path extends KnownCreatePaths>(
        resource: Path,
        params: { payload: PayloadForCreate<Path> },
    ): Promise<ResponseForCreate<Path> | ResourceCreateErrors> {
        return this.consume('POST', resource, params.payload) as ResponseForCreate<Path> | ResourceCreateErrors
    }

    async update<Path extends KnownCreatePaths>(
        resource: Path,
        params: { id: string; payload: PayloadForCreate<Path> },
    ): Promise<ResponseForCreate<Path> | ResourceCreateErrors> {
        return this.consume('PUT', `${resource}/${params.id}`, params.payload) as
            | ResponseForCreate<Path>
            | ResourceCreateErrors
    }

    async batch(
        type: 'batch' | 'transaction',
        resources: FhirBatchBundle['entry'],
    ): Promise<FhirBatchResponseBundle | ResourceBatchErrors> {
        return this.consume('POST', `Bundle/${type}`, resources) as FhirBatchResponseBundle | ResourceBatchErrors
    }

    async validate(): Promise<boolean> {
        return this.options.valid ?? true
    }

    getClaim(claim: string): ClaimErrors | string | Record<string, unknown>
    getClaim<ExpectedClaimSchema extends z.ZodType>(
        claim: string,
        schema: ExpectedClaimSchema,
    ): z.infer<ExpectedClaimSchema> | ClaimErrors
    getClaim<ExpectedClaimSchema extends z.ZodType>(
        claim: string,
        schema?: ExpectedClaimSchema,
    ): z.infer<ExpectedClaimSchema> | ClaimErrors | string | Record<string, unknown> {
        const value = this.options.claims?.[claim]
        if (value == null) return { error: 'CLAIM_NOT_FOUND' }
        if (!schema) return value
        const parsed = schema.safeParse(value)
        return parsed.success ? parsed.data : { error: 'CLAIM_INVALID' }
    }

    getValidationReport(): Validation[] {
        return this.options.validationReport ?? []
    }

    /** Throw if any finite reply was not consumed. Persistent replies are excluded. */
    assertAllUsed(): void {
        const unused = this.stubs.filter((stub) => stub.remaining !== 0 && stub.remaining !== Infinity)
        if (unused.length) {
            throw new Error(
                `Unused MockReadyClient replies: ${unused.map((stub) => `${stub.method} ${stub.path} (${stub.remaining} remaining)`).join(', ')}`,
            )
        }
    }

    reset(): void {
        this.stubs.length = 0
    }

    private consume(method: Stub['method'], path: string, payload?: unknown): unknown {
        const stub = this.stubs.find(
            (candidate) =>
                candidate.remaining > 0 &&
                candidate.method === method &&
                candidate.path === path &&
                (!candidate.matchPayload || isDeepStrictEqual(candidate.payload, payload)),
        )
        if (!stub) {
            const available = this.stubs
                .filter((candidate) => candidate.remaining > 0)
                .map(
                    (candidate) =>
                        `${candidate.method} ${candidate.path}${candidate.matchPayload ? ' (with payload)' : ''}`,
                )
            throw new Error(
                `Unexpected MockReadyClient call: ${method} ${path}. Available replies: ${available.join(', ') || '(none)'}`,
            )
        }
        if (stub.remaining !== Infinity) stub.remaining--
        return stub.result
    }
}
