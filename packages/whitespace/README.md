# @mkaradeniz/oxlint-plugin-whitespace

Opinionated Oxlint whitespace rules for the way I like React and TypeScript files to breathe.

## Install

```sh
pnpm add -D @mkaradeniz/oxlint-plugin-whitespace
```

## Usage

```ts
import { defineConfig } from 'oxlint';

export default defineConfig({
  jsPlugins: [
    {
      name: '@mkaradeniz/whitespace',
      specifier: '@mkaradeniz/oxlint-plugin-whitespace',
    },
  ],
  rules: {
    '@mkaradeniz/whitespace/jsx-child-spacing': ['warn'],
    '@mkaradeniz/whitespace/react-next-organization': [
      'warn',
      {
        orderDiagnostics: false,
      },
    ],
    '@mkaradeniz/whitespace/statement-spacing': ['warn'],
  },
});
```

## Rules

- `@mkaradeniz/whitespace/statement-spacing`: inserts blank lines between imports and code, control-flow blocks and siblings, declaration/action boundaries, await groups, and selected multiline declarations.
- `@mkaradeniz/whitespace/jsx-child-spacing`: inserts blank lines between significant multiline JSX siblings while preserving compact inline parents.
- `@mkaradeniz/whitespace/react-next-organization`: groups React and Next component statements, fixes blank lines between already-correct adjacent groups, and can report ordering diagnostics without moving statements.
