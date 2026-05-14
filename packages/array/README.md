# @mkaradeniz/oxlint-plugin-array

Oxlint rules for treating arrays as immutable by default.

## Install

```sh
pnpm add -D @mkaradeniz/oxlint-plugin-array
```

## Usage

```ts
import { defineConfig } from 'oxlint';

export default defineConfig({
  jsPlugins: [
    {
      name: '@mkaradeniz/array',
      specifier: '@mkaradeniz/oxlint-plugin-array',
    },
  ],
  rules: {
    '@mkaradeniz/array/no-mutation': ['warn'],
  },
});
```

## Rules

- `@mkaradeniz/array/no-mutation`: reports syntactically obvious calls to mutating array methods on existing values. It skips clearly fresh temporary arrays such as literals, spread copies, `Array.from`, `.slice()`, and `.concat()` chains. It fixes only mechanically safe cases: value-producing `sort`, `reverse`, and `splice` calls become `toSorted`, `toReversed`, and `toSpliced`; simple expression-statement `push`, `pop`, `shift`, and `unshift` calls on stable assignable receivers become immutable reassignment patterns. Ambiguous receivers, mutating return values, optional assignment cases, `fill`, and `copyWithin` report without fixes.
