# Getting started

::: danger 🚧 Under active development! 🚧

This library is under active development is not ready for production. But feel free to try it out and give feedback!

:::

### Prerequisites

::: info

This dependency is available only on Github Package registry (GPR). GPR does not allow anonymous pulls, so you need to
configure a personal access token (PAT).

:::

See the
[GPR documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#authenticating-to-github-packages)
for more information.

So you will need to configure the @navikt scope to use the GPR specifically. For `npm` you can follow the
["Installing a package"](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#installing-a-package)
docs.

For yarn (2-4) I recommend configuring the `.yarnrc.yml` file in your project root:

```yaml
npmScopes:
  navikt:
    npmAlwaysAuth: true
    npmAuthToken: '${NPM_AUTH_TOKEN:-}'
    npmRegistryServer: 'https://npm.pkg.github.com'
```

For pnpm and bun, please refer to their respective documentation on how to configure the GPR.

### Installing

Once you have access to GPR configured, you can install the package using your package manager of choice.

```sh
npm i @navikt/smart-on-fhir // [!=npm auto]
```

::: info

When you have the library installed, you can move on to the next step:

[Your first launch](./your-first-launch.md).

:::
