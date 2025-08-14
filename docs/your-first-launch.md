# Your first launch

This will take you through a secure
[EHR Launch](https://build.fhir.org/ig/HL7/smart-app-launch/app-launch.html#launch-app-ehr-launch) using this library.

A server side Smart on FHIR launch consists of the following steps:

1. The EHR launches your app by redirecting the user to your app's launch URL with `launch` and `iss` parameters.
2. Your app redirects the user to the authorization server of the EHR.
3. The EHR server is authenticated and returns the user to your app.
4. Your app exchanges the authorization code for an access token and an ID-token.
5. Your app can now make FHIR API calls using the access token.

## Setting up the [SmartClient](docs/smart-client.md)

First we need to configure the SmartClient, we do this by instantiating a `SmartClient` with the provided issuer.

::: tip Caution!

Remember to always instantiate the `SmartClient` _**every**_ request. You should never share an instance between
multiple requests.

You can use an instance multiple times in a single request, but it's important to remember that a instance is _only_ for
a specific launch.

:::

Let's have a look at the basic configuration needed for the `SmartClient`:

```typescript
const client = new SmartClient(sessionId, storage, {
  clientId: 'test-client',
  scope: 'openid fhirUser launch/patient',
  callbackUrl: 'https://example.com/fhir/callback',
  redirectUrl: 'https://example.com/fhir',
  allowAnyIssuer: true,
})
```

The `sessionId` is up to you to control, you should use a http-only secure cookie to store the session ID. Get it from
the request headers and pass it to the SmartClient.

Next, lets take a look at the `storage` parameter. To be able to use the SmartClient, you must provide a server-side
session storage. You can use whatever backing-store you want, for example Valkey/Redis, or anything else. You only have
to implement a simple interface ([SmartStorage](./docs/smart-storage.md)).

Here is an example using Valkey:

```typescript
function getSmartStorage(): SmartStorage {
  const valkey = getBackingStore()

  return {
    set: async (sessionId, values) => {
      await valkey.hset(sessionIdKey(sessionId), values)
      await valkey.expire(sessionIdKey(sessionId), 3600 * 24 * 30)
    },
    get: async (sessionId) => {
      return valkey.hgetall(sessionIdKey(sessionId))
    },
  }
}
```

The `callbackUrl` in there whe FHIR-server will redirect the user after authorization. Redirect URL is where we'll
redirect the user after token-exchange.

The `allowAnyIssuer: true` configuration is used to allow launches from any issuer. Normally we would want to restrict
access to the application to a list of known issuers, but this depends on the type of application you are building.

## Launching

Let's say that we have a Smart on FHIR application running at `https://example.com/fhir`. We'll configure our web server
with the following routes:

- /fhir/launch - EHR will launch the application to this route
- /fhir/callback - User is redirected here after authorization
- /fhir - This is where we'll have the actual web-app

You don't have to use exactly these routes, but this is a common pattern in SoF and OIDC login flows.

### Initial launch (/fhir/launch)

Given the setup above, the EHR will "launch" using the following URL:

```
https://example.com/fhir/launch?iss=<EHR-FHIR-URL>&launch=12345
```

Let's implement the `/fhir/launch` route in our web server, using standard Request/Response Web APIs:

```typescript {2,8-11,22-25,34-37,49-52}
async function launchRoute(req: Request): Promise<Response> {
  /* retrieve your session ID from a secure cookie */
  const sessionId = 'foo'
  if (sessionId == null) {
    return new Response('No session ID found', { status: 400 })
  }

  /**
   * Extract iss and launch parameters from the request URL,
   * we need these for the launch
   */
  const url = new URL(req.url)
  const issuer = url.searchParams.get('iss')
  const launch = url.searchParams.get('launch')

  if (issuer == null || launch == null) {
    return new Response('Missing required params: iss or launch', {
      status: 400,
    })
  }

  /**
   * Instantiate the SmartClient with our current sessionId,
   * backing Valkey store and the apps configuration.
   */
  const client = new SmartClient(sessionId, getSmartStorage(), {
    clientId: 'test-client',
    scope: 'openid fhirUser launch/patient',
    callbackUrl: 'https://example.com/fhir/callback',
    redirectUrl: 'https://example.com/fhir',
    allowAnyIssuer: true,
  })

  /**
   * Initiate the launch process given the provided
   * EHR FHIR issuer and launch parameter
   */
  const launchResult = await client.launch({
    iss: issuer,
    launch: launch,
  })

  if ('error' in launchResult) {
    return new Response(`Launch error: ${launchResult.error}`, {
      status: 500,
    })
  }

  /**
   * Given a successful launch, we redirect the user to the
   * EHR's authorization server
   */
  return Response.redirect(launchResult.redirect_url, 302)
}
```

The highlighted comments show the important steps in the launch process. Most of the code above is handling request
params and graceful error handling.

The user is now redirected to the EHR's authorization server, and given a successful login, will end up back at our
`/fhir/callback` route.

### Callback (/fhir/callback)

When the user returns, the EHR redirects to our configured callbackUrl, which in our case is `/fhir/callback`. This
route will verify a few OIDC security mechanism (state, PKCE) and then exchange the authorization code for our tokens,
and update the storage with these values.

To do this, we'll need to implement our `/fhir/callback` route:

```typescript {2,8-12,23-28,37-41,49-52}
async function callbackHandler(req: Request): Promise<Response> {
  /* retrieve your session ID from a secure cookie */
  const sessionId = 'foo'
  if (sessionId == null) {
    return new Response('No session ID found', { status: 400 })
  }

  /**
   * The auth server has provided us with a code and state in
   * the query parameters, we need both of these to handle
   * the callback.
   */
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (code == null || state == null) {
    return new Response('Missing required params: code or state', {
      status: 400,
    })
  }

  /**
   * Instantiate our smart client again, this is the same
   * configuration as during the launch, and can safely be
   * extracted to a reusable function (but don't share the
   * instance between requests!).
   */
  const client = new SmartClient(sessionId, getSmartStorage(), {
    clientId: 'test-client',
    scope: 'openid fhirUser launch/patient',
    callbackUrl: 'https://example.com/fhir/callback',
    redirectUrl: 'https://example.com/fhir',
    allowAnyIssuer: true,
  })

  /**
   * Actually complete the callback, this will verify the state,
   * PKCE and exchange the authorization code for an access
   * token and ID-token for us.
   */
  const callbackResult = await client.callback({ code, state })
  if ('error' in callbackResult) {
    return new Response(`Login failed: ${callbackResult.error}`, {
      status: 500,
    })
  }

  /**
   * The callback was successful, lets redirect the user to
   * the actual web-app
   */
  return Response.redirect(callbackResult.redirect_url, 302)
}
```

Given a successful state and PKCE verification, as well as a token exchange, the user will be completely launched and
ready to access data from the EHR FHIR server.

Once the user is finally on the web-app route, we can move on to creating a [ReadyClient](./docs/ready-client.md) to
access the FHIR data.

### Ready!

Now that we have a complete session for this user, we can use our `SmartClient` to instantiate a `ReadyClient`. With the
`ReadyClient` we can easily access our [Practitioner](https://hl7.org/fhir/R4/practitioner.html),
[Patient](https://hl7.org/fhir/R4/patient.html), [Encounter](https://hl7.org/fhir/R4/encounter.html) or any other FHIR
resources.

:::tip Important!

This library, and both _SmartClient_ and _ReadyClient_ are **only** for use in a server environment. If you have a
isomorphic web-app using frameworks such as Next.js, SvelteKit, Astro or similar, you will have ta be aware of where you
are executing during data loading.

The simplest approach is to create HTTP APIs in your web-app that fetches what you need, and the client-side code in
your web-app can call these APIs.

:::

Let's create a simple custom endpoind for our web-app that fetches some FHIR resources using the `ReadyClient`.

This route can for example be configured under the route `/api/fhir-example` as a `GET` resource.

```typescript {8-13,22,25-28,31-34,39}
async function callbackHandler(req: Request): Promise<Response> {
  /* retrieve your session ID from a secure cookie */
  const sessionId = 'foo'
  if (sessionId == null) {
    return new Response('No session ID found', { status: 400 })
  }

  /**
   * Instantiate our smart client again, this is the same
   * configuration as during the launch, and can safely be
   * extracted to a reusable function (but don't share the
   * instance between requests!).
   */
  const client = new SmartClient(sessionId, getSmartStorage(), {
    clientId: 'test-client',
    scope: 'openid fhirUser launch/patient',
    callbackUrl: 'https://example.com/fhir/callback',
    redirectUrl: 'https://example.com/fhir',
    allowAnyIssuer: true,
  })

  // Instantiate our ReadyClient given our current session
  const readyClient = client.ready()

  /**
   * You can chose to validate the user's session,
   * you should do this once per request
   */
  const validToken = await readyClient.validate()

  /**
   * Your error handling could be more sophisticated, but
   * this is a simple example
   */
  if ('error' in readyClient || !validToken) {
    return new Response('Invalid session', { status: 401 })
  }

  // Now we can use the ReadyClient to fetch FHIR resources
  const patient = await readyClient.patient.request()
  const practitioner = await readyClient.practitioner.request()
  const encounter = await readyClient.encounter.request()

  // Return the resources as JSON after handling any errors
  return new Response.json({ foo: 'baz' }, { status: 200 })
}
```

Each request for a FHIR resource requires some error handling, see the
[ReadyClient documentation](./docs/ready-client.md) for more information on how to handle errors and responses. But all
of the requests return a union with a potential `{ error: string }` type.

These examples use the short-hand API for fetching specific resources, in the
[ReadyClient documentation](./docs/ready-client.md) you'll find more details on how to request arbitrary resources.
