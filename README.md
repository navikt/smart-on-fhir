# @navikt/smart-on-fhir

This is a server-only library for launching a Smart on FHIR application, as well as fetching
resources from the FHIR server.

This is built on modern Request/Response Web APIs, and is intended to be used in a server
environment.

> ⚠️ **Warning**
>
> This library is under active development and is **not production ready**. Use at your own risk.

## Points of interest

- [Documentation](https://navikt.github.io/smart-on-fhir/)
- Main entry points:
  - [SmartClient](src/client/smart/SmartClient.ts) - Smart on FHIR launch, callback and
    authorization
  - [ReadyClient](src/client/smart/ReadyClient.ts) - Access FHIR resources

## Mocking a ready client

The optional `@navikt/smart-on-fhir/test` entry point provides an in-memory `MockReadyClient`. It
needs no session, server, network interceptor, or test-runner integration:

```ts
import { MockReadyClient } from '@navikt/smart-on-fhir/test'
import type { ReadyClient } from '@navikt/smart-on-fhir/client'

const ready = new MockReadyClient({
  patientId: 'patient-1',
  encounterId: 'encounter-1',
  userId: 'practitioner-1',
})

ready
  .on('Patient')
  .get('patient-1')
  .reply({
    resourceType: 'Patient',
    id: 'patient-1',
    name: [{ family: 'Doe', given: ['Jane'] }],
  })
ready.on('Practitioner').get('practitioner-1').replyNotFound()

async function loadPatient(client: ReadyClient) {
  return client.patient.request()
}

const patient = await loadPatient(ready)
const practitioner = await ready.user.request()
ready.assertAllUsed()
```

Replies are matched by method and exact path, consumed once by default, and checked against the
resource's TypeScript type. Unexpected calls throw; `assertAllUsed()` detects unused replies. Use
`.times(n)` or `.persist()` for repeated calls. For other operations, use
`on('Condition').search('patient=patient-1').reply(searchset)`,
`onCreate('DocumentReference').withPayload(payload).reply(document)`,
`onUpdate('DocumentReference', id).reply(document)`, or `onBatch('batch').reply(batchResponse)`.
Errors can be supplied via `.replyError({ error: ... })`.

`MockReadyClient` extends `ReadyClient`, so existing application functions typed as `ReadyClient`
accept the mock without changing their signatures.
