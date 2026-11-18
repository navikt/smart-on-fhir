export type TokenExchangeErrors = {
    error: 'TOKEN_EXCHANGE_FAILED' | 'TOKEN_EXCHANGE_INVALID_BODY' | 'UNKNOWN_ERROR'
}

export type RefreshTokenErrors = {
    error: 'REFRESH_TOKEN_FAILED' | 'REFRESH_TOKEN_INVALID_BODY' | 'UNKNOWN_ERROR'
}
