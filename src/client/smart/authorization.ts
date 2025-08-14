import type { InitialSession } from '../storage/schema'

import type { SmartClientConfiguration } from './config'

type AuthUrlOpts = Pick<InitialSession, 'issuer' | 'state' | 'authorizationEndpoint'> & {
    launch: string
    codeChallenge: string
}

export async function buildAuthUrl(opts: AuthUrlOpts, config: SmartClientConfiguration): Promise<string> {
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        scope: config.scope,
        redirect_uri: config.callbackUrl,
        aud: opts.issuer,
        launch: opts.launch,
        state: opts.state,
        code_challenge: opts.codeChallenge,
        code_challenge_method: 'S256',
    })
    return `${opts.authorizationEndpoint}?${params.toString()}`
}
