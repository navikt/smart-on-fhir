export function assertNotBrowser(): void {
    // biome-ignore lint/suspicious/noExplicitAny: we don't want to configure tsconfig with browser types only for this
    if (typeof (globalThis as any).window !== 'undefined') {
        throw new Error(
            'Oops! You seem to have bundled @navikt/smart-on-fhir in your browser. This library is server-side only. Please make sure you are using this library properly.',
        )
    }
}

export function assertGoodSessionId(sessionId: string | null | undefined): asserts sessionId is string {
    if (sessionId == null || sessionId.length === 0) {
        throw new Error('Session ID is missing or empty. Please provide a valid session ID.')
    }

    if (process.env.NODE_ENV === 'production' && sessionId.length < 10) {
        throw new Error('Session ID is too short, are you sure you are creating cryptographically good IDs?')
    }
}

export function removeTrailingSlash(url: string): string {
    return url.replace(/\/$/, '')
}

export function inferResourceType(path: string): string {
    return path.match(/(\w+)\b/)?.[1] ?? 'Unknown'
}
