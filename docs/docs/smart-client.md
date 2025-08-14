---
outline: deep
---

# SmartClient

The SmartClient is used to:

- Handle the launch from an EHR
  - Looks up well-known
  - Handles PKCE verification
  - Redirects to the FHIR authorization server
- Handle the callback after an authorized user returns from the FHIR authorization server
  - Verifies PKCE and state
  - Retrieves the access token, ID-token and refresh token as well as Smart on FHIR context
  - Refreshing tokens using the refresh token when needed
- Manage users sessions

## `class SmartClient(...)`

Normal usage of SmartClient, only needs to provide a sessionId and client configuration, as well as a backing store.

| Name      | Type                                                             | Description                                        |
| --------- | ---------------------------------------------------------------- | -------------------------------------------------- |
| sessionId | string                                                           | Current users sessionId                            |
| storage   | [SmartStorage](./docs/smart-storage.md)                          | Server side storage implementation                 |
| config    | [SmartClientConfiguration](./docs/smart-client-configuratios.md) | Smart on FHIR client configuration                 |
| options?  | [SmartClientOptions](./docs/smart-client-options.md) \| null     | Options for enabling or disabling certain features |

## `class SmartClient(...)` (multi-launch mode)

To enable support for launching multiple sessions using the same sessionId, you need to instantiate the SmartClient with
an extra patient ID during initialization.

| Name     | Description                                        | Type                                                                                 |
| -------- | -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| session  | Current sessionId and activePatient (if present)   | `{ sessionId: string, activePatient: string \| null }`                               |
| storage  | Server side storage implementation                 | [SmartStorage](./docs/smart-storage.md)                                              |
| config   | Smart on FHIR client configuration                 | [SmartClientConfiguration](./docs/smart-client-configuratios.md)                     |
| options? | Options for enabling or disabling certain features | [SmartClientOptions](./docs/smart-client-options.md) `& { enableMultiLaunch: true }` |

When multi-launch mode is enabled, when the client redirects to the final `redirectUrl`, it will include the `patient`
query parameter with the launched patients ID (FHIR). This must be parsed from the URL by the application and stored in
for example [sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage).

This ID _must_ be used in any subsequent instantiations of the SmartClient (and it's subsequent `.ready()` calls) to
ensure that each session is correctly associated with the launched patient.
