import type { InitialSession } from '../../storage/schema'

import { createClientAssertion } from './client-assertion'
import type { FhirAuthMode } from './config'

export type TokenRequestPayload =
    | {
          grant_type: 'authorization_code'
          client_id: string
          code: string
          code_verifier: string
          redirect_uri: string
      }
    | {
          grant_type: 'refresh_token'
          client_id: string
          refresh_token: string
      }

export async function postFormEncodedTokenEndpoint(
    payload: TokenRequestPayload,
    session: InitialSession,
    clientId: string,
    authMode: FhirAuthMode,
): Promise<Response> {
    if (authMode.type === 'public') {
        return await fetch(session.tokenEndpoint, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(payload),
        })
    }

    switch (authMode.method) {
        case 'client_secret_post': {
            const newBody = new URLSearchParams(payload)
            newBody.append('client_secret', authMode.clientSecret)

            return await fetch(session.tokenEndpoint, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: newBody,
            })
        }

        case 'client_secret_basic': {
            const encodedCredentials = Buffer.from(`${clientId}:${authMode.clientSecret}`).toString('base64')
            return await fetch(session.tokenEndpoint, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: `Basic ${encodedCredentials}`,
                },
                body: new URLSearchParams(payload),
            })
        }

        case 'private_key_jwt': {
            const clientAssertion = await createClientAssertion(clientId, session, authMode)

            const newBody = new URLSearchParams(payload)
            newBody.append('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer')
            newBody.append('client_assertion', clientAssertion)

            return await fetch(session.tokenEndpoint, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: newBody,
            })
        }

        default:
            throw new Error(`Invariant violation: Unknown FHIR auth mode: ${authMode['type'] as string}`)
    }
}
