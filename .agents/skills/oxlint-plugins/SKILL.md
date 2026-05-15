---
name: oxlint-plugins
description: Publish the oxlint-plugins monorepo packages.
---

# Oxlint Plugins Publishing

1. For every user-facing plugin behavior change, run `pnpm run changeset` and choose the changed package plus the semver bump.
2. Do not add a changeset for docs-only, test-only, CI-only, or internal refactor changes unless published package behavior changes.
3. Run `pnpm install`, then `pnpm run verify`.
4. Commit the change and push `main`.
5. The `publish.yml` workflow opens or updates a `chore(release): version packages` PR when changesets exist.
6. Merge the Version Packages PR to publish changed packages through npm Trusted Publishing.
7. Create or confirm the publish environment:
   `gh api --method PUT repos/mkaradeniz/oxlint-plugins/environments/npm-publish`
8. Ensure npm Trusted Publishing is configured per published package:
   - Repository: `mkaradeniz/oxlint-plugins`
   - Workflow filename: `publish.yml`
   - Environment: `npm-publish`

Publishable plugin runtime dependency fields must use real npm versions, never `catalog:` or `workspace:`. Do not use npm tokens for established packages; publish via GitHub Actions OIDC.

Releases use package-scoped tags such as `@mkaradeniz/oxlint-plugin-array@1.0.0`. Do not create repo-wide `v*` release tags.

New npm packages may require one initial bootstrap publish before npm Trusted Publishing can be configured for that package.
