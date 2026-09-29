import { isDeepStrictEqual } from 'node:util'

import type { ResourceRequestErrors } from '../client/smart/types/client-errors'

type Method = 'GET' | 'POST' | 'PUT'

type Reply = {
    method: Method
    path: string
    result: unknown
    remaining: number
    payload?: unknown
    matchPayload: boolean
}

export class ReplyBuilder<Success, Failure, Payload = never> {
    private payload?: Payload
    private matchPayload = false
    private count = 1
    private replyEntry?: Reply

    constructor(
        private readonly replies: Reply[],
        private readonly method: Method,
        private readonly path: string,
    ) {}

    withPayload(payload: Payload): this {
        this.payload = payload
        this.matchPayload = true
        if (this.replyEntry) {
            this.replyEntry.payload = payload
            this.replyEntry.matchPayload = true
        }
        return this
    }

    times(count: number): this {
        if (!Number.isSafeInteger(count) || count < 1) throw new Error('times() requires a positive integer')
        this.count = count
        if (this.replyEntry) this.replyEntry.remaining = count
        return this
    }

    persist(): this {
        this.count = Infinity
        if (this.replyEntry) this.replyEntry.remaining = Infinity
        return this
    }

    reply(result: Success | Failure): this {
        if (this.replyEntry) throw new Error(`Reply already configured for ${this.method} ${this.path}`)
        this.replyEntry = {
            method: this.method,
            path: this.path,
            result,
            remaining: this.count,
            payload: this.payload,
            matchPayload: this.matchPayload,
        }
        this.replies.push(this.replyEntry)
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

export class Replies {
    private readonly entries: Reply[] = []

    request<Success>(path: string): RequestReplyBuilder<Success> {
        return new RequestReplyBuilder(this.entries, 'GET', path)
    }

    write<Success, Failure, Payload>(method: 'POST' | 'PUT', path: string): ReplyBuilder<Success, Failure, Payload> {
        return new ReplyBuilder(this.entries, method, path)
    }

    consume(method: Method, path: string, payload?: unknown): unknown {
        const reply = this.entries.find(
            (entry) =>
                entry.remaining > 0 &&
                entry.method === method &&
                entry.path === path &&
                (!entry.matchPayload || isDeepStrictEqual(entry.payload, payload)),
        )
        if (!reply) {
            const available = this.entries
                .filter((entry) => entry.remaining > 0)
                .map((entry) => `${entry.method} ${entry.path}${entry.matchPayload ? ' (with payload)' : ''}`)
            throw new Error(
                `Unexpected MockReadyClient call: ${method} ${path}. Available replies: ${available.join(', ') || '(none)'}`,
            )
        }
        if (reply.remaining !== Infinity) reply.remaining--
        return reply.result
    }

    assertAllUsed(): void {
        const unused = this.entries.filter((entry) => entry.remaining !== 0 && entry.remaining !== Infinity)
        if (unused.length) {
            throw new Error(
                `Unused MockReadyClient replies: ${unused.map((entry) => `${entry.method} ${entry.path} (${entry.remaining} remaining)`).join(', ')}`,
            )
        }
    }

    reset(): void {
        this.entries.length = 0
    }
}
