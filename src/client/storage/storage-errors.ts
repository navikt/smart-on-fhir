export type InitialSessionErrors = { error: 'BROKEN_SESSION_STATE' | 'NO_STATE' }

export type CompleteSessionErrors = InitialSessionErrors | { error: 'INCOMPLETE_SESSION' }
