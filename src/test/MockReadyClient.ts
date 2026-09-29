import { ReadyClient } from '../client'
import type { Validation } from '../client'
import type {
    KnownCreatePaths,
    PayloadForCreate,
    ResponseForCreate,
} from '../client/fhir/resources/create-resource-map'
import type { KnownPaths, ResponseFor } from '../client/fhir/resources/resource-map'
import type {
    ResourceBatchErrors,
    ResourceCreateErrors,
    ResourceRequestErrors,
} from '../client/smart/types/client-errors'
import type { FhirBatchBundle, FhirBatchResponseBundle } from '../zod'

import { mockClient, mockSession } from './mock-session'
import { Replies, type ReplyBuilder, type RequestReplyBuilder } from './replies'

type ReadResourceType = Exclude<ResponseFor<KnownPaths>['resourceType'], 'Bundle'>
type ReadResource<Type extends ReadResourceType> = ResponseFor<`${Type}/${string}`>
type SearchResult = ResponseFor<`Condition?${string}`>

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

export class MockReadyClient extends ReadyClient {
    private readonly replies = new Replies()
    private readonly mockOptions: MockReadyClientOptions

    constructor(options: MockReadyClientOptions) {
        super(mockClient(), mockSession(options), options.issuerName ?? 'Mock issuer')
        this.mockOptions = options
    }

    on(type: 'Condition'): ConditionBuilder
    on<Type extends ReadResourceType>(type: Type): ResourceBuilder<Type>
    on(type: ReadResourceType | 'Condition'): ResourceBuilder<ReadResourceType> | ConditionBuilder {
        if (type === 'Condition') {
            return {
                search: (query) => this.replies.request<SearchResult>(`Condition?${String(query).replace(/^\?/, '')}`),
            }
        }
        return { get: (id) => this.replies.request<ReadResource<ReadResourceType>>(`${type}/${id}`) }
    }

    onCreate<Type extends KnownCreatePaths>(
        type: Type,
    ): ReplyBuilder<ResponseForCreate<Type>, ResourceCreateErrors, PayloadForCreate<Type>> {
        return this.replies.write('POST', type)
    }

    onUpdate<Type extends KnownCreatePaths>(
        type: Type,
        id: string,
    ): ReplyBuilder<ResponseForCreate<Type>, ResourceCreateErrors, PayloadForCreate<Type>> {
        return this.replies.write('PUT', `${type}/${id}`)
    }

    onBatch(
        type: 'batch' | 'transaction',
    ): ReplyBuilder<FhirBatchResponseBundle, ResourceBatchErrors, FhirBatchBundle['entry']> {
        return this.replies.write('POST', `Bundle/${type}`)
    }

    async request<Path extends KnownPaths>(
        resource: Path,
        _config?: { cache?: { ttl: number }; expectNotFound?: true },
    ): Promise<ResponseFor<Path> | ResourceRequestErrors> {
        return this.replies.consume('GET', resource) as ResponseFor<Path> | ResourceRequestErrors
    }

    async create<Path extends KnownCreatePaths>(
        resource: Path,
        params: { payload: PayloadForCreate<Path> },
    ): Promise<ResponseForCreate<Path> | ResourceCreateErrors> {
        return this.replies.consume('POST', resource, params.payload) as ResponseForCreate<Path> | ResourceCreateErrors
    }

    async update<Path extends KnownCreatePaths>(
        resource: Path,
        params: { id: string; payload: PayloadForCreate<Path> },
    ): Promise<ResponseForCreate<Path> | ResourceCreateErrors> {
        return this.replies.consume('PUT', `${resource}/${params.id}`, params.payload) as
            | ResponseForCreate<Path>
            | ResourceCreateErrors
    }

    async batch(
        type: 'batch' | 'transaction',
        resources: FhirBatchBundle['entry'],
    ): Promise<FhirBatchResponseBundle | ResourceBatchErrors> {
        return this.replies.consume('POST', `Bundle/${type}`, resources) as
            | FhirBatchResponseBundle
            | ResourceBatchErrors
    }

    async validate(): Promise<boolean> {
        return this.mockOptions.valid ?? true
    }

    getValidationReport(): Validation[] {
        return this.mockOptions.validationReport ?? []
    }

    assertAllUsed(): void {
        this.replies.assertAllUsed()
    }

    reset(): void {
        this.replies.reset()
    }
}
