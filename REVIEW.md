# Code Review: `@navikt/smart-on-fhir`

A well-structured server-side SMART on FHIR library built on Web `Request`/`Response`. The
error-as-value pattern (`{ error: '...' }` unions) is applied consistently, OTEL tracing is
thorough, and the type-level path→schema mapping is clever. Findings below are grouped by severity.

## Security / correctness (high priority)

### 1. `validate()` assumes the access token is a JWT — `src/client/smart/ReadyClient.ts:86`
`validate()` relies on `jwtVerify` to reject expired tokens. That works for JWT access tokens, but
SMART access tokens are *opaque* per spec — many real FHIR servers issue non-JWT access tokens.
`validate()` will then always return `false` (caught by the try/catch at `ReadyClient.ts:108`),
which is misleading. Worth documenting that `validate()` only works for JWT access tokens, or
validating the `idToken` instead.

### 2. `getAuthMode`/`getKnownFhirServer` keyed by `session.server`, not `issuer` — `src/client/smart/SmartClient.ts:434` (see the `TODO` at `:233`)
`knownFhirServers` are matched by `issuer`, but `callback`/`refresh` look them up by
`session.server`. These happen to be equal in tests (`iss === server`), but for servers where the
issuer differs from the FHIR base URL, a confidential client would silently fall back to
`{ type: 'public' }` (`SmartClient.ts:435`) and send no credentials. This is a latent auth-failure
bug. Recommend resolving the TODO before multi-server go-live.

### 3. `aud` is set to `smartConfig.issuer` rather than the FHIR server — `src/client/smart/SmartClient.ts:467`
Per SMART App Launch, the `aud` parameter on the authorization request must be the FHIR resource
server URL (the `iss` the EHR handed you), not the OAuth issuer. Here `opts.issuer` comes from
`smartConfig.issuer` (`SmartClient.ts:169`). Where issuer ≠ FHIR base URL, strict servers will
reject the launch. Worth verifying against the spec and the target servers.

### 4. Patient ID injected into storage key + redirect URL without format validation — `src/client/smart/SmartClient.ts:265-268`
In multi-launch mode the storage key becomes `${sessionId}:${patient}` and the patient ID is placed
in a query param. `patient` comes from the token response and is only validated as `z.string()`
(`token-schema.ts:10`). A malicious/compromised issuer could supply a patient value containing `:`
or other characters affecting the key namespace. Low risk given trusted issuers, but worth a format
constraint.

## API / design issues (medium priority)

### 5. `update()` reports `CREATE_FAILED_*` and has a copy-paste log message — `src/client/smart/ReadyClient.ts:156-195`
`update()` reuses the create error codes (`CREATE_FAILED_NON_OK_RESPONSE`), and there's a
copy-paste leftover: the parse-failure log says `'Failed to parse DocumentReference (from
PUT/update)'` (`ReadyClient.ts:186`) even for `QuestionnaireResponse`. Also, unlike `request()`,
neither `create()` nor `update()` special-case 404. The hardcoded resource name in the log is a
real bug.

### 6. `create`/`update` validate the *response* with the **base** schema while typing the return as the **full** type — `src/client/fhir/resources/create-resource-map.ts:47`
`createResourceToSchema('DocumentReference')` returns `FhirDocumentReferenceBaseSchema` (just
`resourceType`/`id`/`meta`), but `ResponseForCreate<'DocumentReference'>` is the full
`FhirDocumentReference`. The `.loose()` parse passes, then it's cast (`ReadyClient.ts:152`) to the
rich type. Consumers get a type that claims fields (`status`, `content`, `subject`, …) that were
never validated to exist. This is a type-safety hole that undermines the "everything is zod'd"
promise.

### 7. Resource cache key omits patient/user/auth context — `src/client/cache/resource-cache-inmem.ts:12` & `resource-cache-custom.ts:23`
Cache key is `${session.server}|${resource}`. For server-scoped resources like `Patient/<id>` this
is fine because the ID is in the path, but it is *not* scoped by access token or session — any
session hitting the same server+path shares the cache entry. That's likely intended (resources are
server-global), but it means a cached resource is served regardless of whether the *current*
session is authorized for it. The cache TTL is the only protection. Worth documenting the trust
assumption.

### 8. `getOrRefresh` double-writes storage — `src/client/smart/SmartClient.ts:392-408`
`this.refresh(session)` already calls `this._storage.set(...)` for both the session and
active-patient keys (`SmartClient.ts:336-339`). Then `getOrRefresh` sets them *again* (`:405-408`).
Redundant writes (4 total). Harmless but wasteful, and a sign the refresh/persist responsibilities
are split awkwardly.

### 9. Refresh requires a new `refresh_token`, breaking servers that omit it — `src/client/smart/token/token-schema.ts:18` / `SmartClient.ts:330-334`
`TokenRefreshResponseSchema` requires `refresh_token` (non-optional). If a server returns a refresh
response *without* a new `refresh_token` (allowed by OAuth — reuse the old one), parsing fails →
`REFRESH_TOKEN_INVALID_BODY`. Many servers omit it on refresh. Recommend making `refresh_token`
optional and falling back to the existing one.

## Robustness / smaller issues (low priority)

### 10. `inferResourceType` regex on `Condition?` — `src/client/smart/lib/utils.ts:25`
`path.match(/(\w+)\b/)` returns `Condition` for `Condition?...`, which is correct. Noting it's
relied upon for span names.

### 11. 404 path in `request()` discards `operationOutcome` — `src/client/smart/ReadyClient.ts:232`
On 404 the code returns `operationOutcome: null` without reading the body, while other branches
parse it. Inconsistent but intentional (404 is an expected case). OK.

### 12. `tokenExpiresIn` returns `0` for tokens with no `exp` — `src/client/smart/token/token.ts:148`
A token without `exp` is treated as "expires now" → always refreshed. Reasonable default, but for
opaque/non-JWT access tokens `decodeJwt` will throw (not return 0), which would surface as an
unhandled error inside `getOrRefresh`. Again the opaque-token assumption (see #1).

### 13. `assertGoodSessionId` length check only in production — `src/client/smart/lib/utils.ts:15`
The `< 10` chars guard is gated on `NODE_ENV === 'production'`. A short ID in staging (non-prod)
won't be caught.

### 14. Declared error variants that are never produced
`UNKNOWN_ERROR` is declared but never produced in `TokenExchangeErrors`/`RefreshTokenErrors`
(`token-errors.ts:2,6`); conversely `SmartClientReadyErrors` lists
`NO_ACTIVE_SESSION`/`INVALID_TOKEN`/`REFRESH_FAILED` (`client-errors.ts:16`) that don't appear to be
emitted from `ready()`. Dead/aspirational error variants make the public union noisier than reality.

## Documentation / hygiene (trivial)

### 15. Broken README link — `README.md:17`
Points to `src/client/ready/ReadyClient.ts`; actual path is `src/client/smart/ReadyClient.ts`.

### 16. Typos in identifiers
`CobeableConceptSchema` (`src/zod/common.ts:13`, exported, so renaming is breaking),
`questionnare-response.ts` filename (`src/zod/`), several "responed" in log strings
(`token.ts:58,63`).

### 17. Dead export
`spanSync` is defined but unused (`src/client/smart/lib/otel.ts:18`).

## Strengths

- Clean error-as-value design; no thrown errors leak across the public API surface (except
  deliberate invariant violations).
- Good OTEL coverage with a centralized taxonomy.
- PKCE/state handling looks correct (`SmartClient.ts:165-194`, state checked at `:217`).
- Multi-launch fallback semantics are well-tested (`multi-launch.test.ts`).
- `assertNotBrowser` guard is a nice touch for a server-only lib.

## Suggested triage

1. Confirm/resolve the `aud` (#3) and `issuer`-vs-`server` auth-mode (#2) questions against the
   SMART spec and your target servers — these are the most likely to bite in production.
2. Make refresh-token rotation optional (#9) and fix the create/update response-validation gap (#6).
3. Clean up the `update()` copy-paste (#5), redundant storage writes (#8), and README/typos.
