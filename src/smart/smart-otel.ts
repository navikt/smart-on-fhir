import { SharedOtelAttributes } from '#internal-lib/otel'

/**
 * Span attributes used by `smart.*` spans.
 */
export const SmartOtelAttributes = {
    ...SharedOtelAttributes,
    AuthorizationType: 'smart.auth-type',
    SmartConfigurationCacheHit: 'smart.well-known.smart-configuration.cache-hit',
    SessionExpired: 'smart.session.expired',
    SessionError: 'smart.session.error',
    SessionRefreshed: 'smart.session.refreshed',
    SessionTokenExpiresInSeconds: 'smart.session.token.expires-in-seconds',
    SessionTokenAlreadyExpired: 'smart.session.token.already-expired',
    SessionRefreshedTokenExpiresInSeconds: 'smart.session.refreshed.token.expires-in-seconds',
    SessionRefreshedNewRefreshToken: 'smart.session.refreshed.new-refresh-token',
    SessionMulti: 'smart.session.multi-launch',
    SessionMultiFallback: 'smart.session.multi-launch.hit-fallback',
} as const
