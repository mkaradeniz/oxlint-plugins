# @mkaradeniz/oxlint-plugin-nullability

Oxlint rules for making nullability checks explicit.

## Install

```sh
pnpm add -D @mkaradeniz/oxlint-plugin-nullability
```

## Usage

```ts
import { defineConfig } from 'oxlint';

export default defineConfig({
  jsPlugins: [
    {
      name: '@mkaradeniz/nullability',
      specifier: '@mkaradeniz/oxlint-plugin-nullability',
    },
  ],
  rules: {
    '@mkaradeniz/nullability/prefer-is-not-null-or-undefined': ['warn'],
  },
});
```

## Rules

- `@mkaradeniz/nullability/prefer-is-not-null-or-undefined`: reports syntactically obvious nullability checks that should use `isNotNullOrUndefined` from `is-not-null-or-undefined`.

This rule is annotation-aware, not powered by Oxlint's native `--type-aware` mode. Oxlint does not yet expose type information to custom JS plugins. Full semantic type-aware support is tracked upstream in [oxc-project/oxc#19596](https://github.com/oxc-project/oxc/issues/19596), with broader JS plugin work tracked in [oxc-project/oxc#19918](https://github.com/oxc-project/oxc/issues/19918).

The preserved type-aware upgrade plan lives in [ADR 0001](../../docs/adr/0001-nullability-type-aware-upgrade.md).
