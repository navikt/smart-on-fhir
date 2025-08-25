# @navikt/smart-on-fhir

This is a server-only library for launching a Smart on FHIR application, as well as fetching resources from the FHIR
server.

This is built on modern Request/Response Web APIs, and is intended to be used in a server environment.

> ⚠️ **Warning**
>
> This library is under active development and is **not production ready**. Use at your own risk.

## Points of interest

- [Documentation](https://navikt.github.io/smart-on-fhir/)
- Main entry points:
  - [SmartClient](src/client/smart/SmartClient.ts) - Smart on FHIR launch, callback and authorization
  - [ReadyClient](src/client/ready/ReadyClient.ts) - Access FHIR resources
