---
outline: deep
---

# Client configuration

When instantiating a `SmartClient`, you will need to configure information about "you", the client.
This is known as the `SmartClientConfiguration`. The client can be configured "open" or "closed",
but the base options are always the same.

| What          | Why                                                                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clientId`    | The name of your application as presented to the FHIR/authorization server                                                                                  |
| `scope`       | The scopes your application will request, see [HL-7 scopes and launch context](https://hl7.org/fhir/smart-app-launch/STU2.2/scopes-and-launch-context.html) |
| `callbackUrl` | The URL that the authorization server will return the user to after successful (or failed) login.                                                           |
| `redirectUrl` | The final route the user will end up after successful callback. This will typically be internally in the app and can differ from `callbackUrl`              |

## Open configuration

You can configure the client to allow launches from any FHIR issuer. You can enable this if you want
to enable launches from anywhere, and control access further down the line.

This is enabled by setting `allowAnyIssuer: true`, full example could look like this:

```ts
const client = new SmartClient(sessionId, getSmartStorage(), {
  clientId: 'test-client',
  scope: 'openid fhirUser launch patient/Patient.read',
  callbackUrl: 'https://example.com/fhir/callback',
  redirectUrl: 'https://example.com/fhir',
  allowAnyIssuer: true,
})
```

## Closed configuration (and confidential clients)

A more secure default would be to only allow launches from a list of known issuers. This also allows
you to configure your client as a confidential client, which means that the client will be able to
authenticate itself to the FHIR server.

Client authentication is used for the token exchange and introspection endpoint (only for opaque
tokens).

Supported options for this are:

- Confidential symmetric: `client_secret_post`
- Confidential symmetric: `client_secret_basic`
- Confidential asymmetric: `private_key_jwt`
- None: Launch as a known issuer, but with no client authentication

To provide a list of known issuers, provide a list of `knownFhirServers` together with your client
configuration. For example:

```ts
const client = new SmartClient(
  sessionId,
  {
    clientId: 'test-client',
    scope: 'openid fhirUser launch patient/Patient.read',
    callbackUrl: 'https://example.com/fhir/callback',
    redirectUrl: 'https://example.com/fhir',
    knownFhirServers: [
      {
        // Known issuer but no client authentication
        name: 'Public known server',
        issuer: 'https//public.example.com',
        type: 'public',
      },
      {
        // Known issuer with client authentication using client_secret_basic or client_secret_post
        name: 'Client secret basic server',
        issuer: 'https://basic.example.com',
        type: 'confidential-symmetric',
        // client_secret_basic or client_secret_post
        method: 'client_secret_basic',
        clientSecret: process.env.EHR_SUPER_SECRET_BASIC,
      },
      {
        // Known issuer with asymmetric client authentication using private_key_jwt
        name: 'Private key JWT server',
        issuer: 'https://basic.example.com',
        type: 'confidential-asymmetric',
        method: 'private_key_jwt',
        privateKey: process.env.EHR_SUPER_SECRET_PRIVATE_KEY_JWT,
      },
    ],
  },
  { storage: getSmartStorage() },
)
```

You can have as many or few known FHIR servers as you want, but the client will only allow launches
from those servers. Remember to not have any secrets in your code. Since `knownFhirServers` is just
JSON, you can choose to load it from configuration any way you want.
