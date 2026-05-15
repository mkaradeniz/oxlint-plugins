# Oxlint Plugins

Personal Oxlint plugins for TypeScript, React, and Next.js code style.

## Packages

- `@mkaradeniz/oxlint-plugin-whitespace`
- `@mkaradeniz/oxlint-plugin-react-structure`
- `@mkaradeniz/oxlint-plugin-array`

Private workspace packages hold shared Oxlint, Oxfmt, and TypeScript config for local development.

## Commands

```sh
pnpm install
pnpm run typecheck
pnpm run test:coverage
pnpm run lint
pnpm run pack:dry-run
pnpm run verify
pnpm run changeset
pnpm run changeset:status
```

Each plugin package is publishable on its own and keeps its own README, tests, and build output.

## Releases

This repo uses Changesets with independent package versions. Add a changeset for every user-facing plugin change:

```sh
pnpm run changeset
```

Docs-only, test-only, CI-only, and internal refactors do not need a changeset unless they change published package behavior. Merging the generated Version Packages PR publishes changed packages through GitHub Actions and npm Trusted Publishing.

Releases use package-scoped tags such as `@mkaradeniz/oxlint-plugin-array@1.0.0`; do not create repo-wide `v*` release tags.
