import type { RefreshTokenErrors, TokenExchangeErrors } from '../launch/token/token-errors'
import type { CompleteSessionErrors, InitialSessionErrors } from '../storage/storage-errors'

export type CallbackError =
    | TokenExchangeErrors
    | InitialSessionErrors
    | {
          error: 'INVALID_STATE'
      }

export type SmartClientReadyErrors =
    | CompleteSessionErrors
    | RefreshTokenErrors
    | {
          error: 'NO_ACTIVE_SESSION' | 'INVALID_ID_TOKEN' | 'INVALID_TOKEN' | 'REFRESH_FAILED' | 'UNKNOWN_ISSUER'
      }

export type ClaimErrors = {
    error: 'CLAIM_NOT_FOUND' | 'CLAIM_INVALID'
}
