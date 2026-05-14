# @mkaradeniz/oxlint-plugin-react-structure

Opinionated Oxlint rules for keeping React component modules small and deliberate.

## Install

```sh
pnpm add -D @mkaradeniz/oxlint-plugin-react-structure
```

## Usage

```ts
import { defineConfig } from 'oxlint';

export default defineConfig({
  jsPlugins: [
    {
      name: '@mkaradeniz/react-structure',
      specifier: '@mkaradeniz/oxlint-plugin-react-structure',
    },
  ],
  rules: {
    '@mkaradeniz/react-structure/component-module-shape': ['warn'],
  },
});
```

## Rules

- `@mkaradeniz/react-structure/component-module-shape`: reports multiple function components in one component module, local props types that are not directly above their component, and helper functions declared below the component.

Next route convention modules are ignored by the rule. shadcn/ui files and generated/vendor paths should be excluded in the consuming config.
