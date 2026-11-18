import nock from 'nock'
import { expect, test } from 'vitest'

import { configureFetchWithRetry } from './fetch'

test('fetch should succeed after retries', async () => {
    const fetchWithRetry = configureFetchWithRetry({ maxAttempts: 3 })

    nock('https://example.com')
        .get('/test')
        .reply(500, 'Internal Server Error')
        .get('/test')
        .reply(500, 'Internal Server Error')
        .get('/test')
        .reply(200, 'Success')

    const response = await fetchWithRetry('https://example.com/test')
    const text = await response.text()

    expect(text).toBe('Success')
})

test('fetch should fail after max retries', async () => {
    const fetchWithRetry = configureFetchWithRetry({ maxAttempts: 2 })

    nock('https://example.com')
        .get('/test')
        .reply(500, 'Internal Server Error')
        .get('/test')
        .reply(500, 'Internal Server Error')

    const response = await fetchWithRetry('https://example.com/test')
    const text = await response.text()

    expect(text).toBe('Internal Server Error')
})
