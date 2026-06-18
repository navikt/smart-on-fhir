import { createClientAssertion } from './client-assertion'
import type { FhirAuthMode } from './config'

export async function postFormEncodedTokenEndpoint(
    tokenEndpoint: string,
    body: URLSearchParams,
    clientId: string,
    authMode: FhirAuthMode,
): Promise<Response> {
    if (authMode.type === 'public') {
        return await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body,
        })
    }

    switch (authMode.method) {
        case 'client_secret_post': {
            const newBody = new URLSearchParams(body.entries())
            newBody.append('client_secret', authMode.clientSecret)

            return await fetch(tokenEndpoint, {
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
            return await fetch(tokenEndpoint, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: `Basic ${encodedCredentials}`,
                },
                body: body,
            })
        }

        case 'private_key_jwt': {
            const clientAssertion = await createClientAssertion(clientId, tokenEndpoint, authMode.privateKey)

            const newBody = new URLSearchParams(body.entries())
            newBody.append('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer')
            newBody.append('client_assertion', clientAssertion)

            return await fetch(tokenEndpoint, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: newBody,
            })
        }

        default:
            throw new Error(`Invariant violation: Unknown FHIR auth mode`)
    }
}
