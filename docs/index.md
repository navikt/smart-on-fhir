---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "A Modern Smart on FHIR library"
  tagline: "@navikt/smart-on-fhir node/deno/bun library"
  actions:
    - theme: brand
      text: Getting Started
      link: /getting-started
    - theme: alt
      text: API Examples
      link: /api-examples

features:
  - title: Server first
    details: No secrets available in the client, all secrets are stored on the server using your favourite key value storage such as Valkey or Redis.
  - title: Modern Web API's
    details: Built using Request/Response API's, so it will work with any Node server framework such as Express, Fastify, or even Next.js
---

