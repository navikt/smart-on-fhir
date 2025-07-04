import type { CompleteSessionErrors, InitialSessionErrors } from '../storage/storage-errors'

import type { RefreshTokenErrors, TokenExchangeErrors } from './token/token-errors'

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
          error: 'NO_ACTIVE_SESSION' | 'INVALID_ID_TOKEN' | 'INVALID_TOKEN' | 'REFRESH_FAILED'
      }

export type ResourceCreateErrors = {
    error: 'CREATE_FAILED_NON_OK_RESPONSE' | 'CREATE_FAILED_INVALID_RESPONSE'
}

export type ResourceRequestErrors = {
    error: 'REQUEST_FAILED_NON_OK_RESPONSE' | 'REQUEST_FAILED_INVALID_RESPONSE' | 'REQUEST_FAILED_RESOURCE_NOT_FOUND'
}
