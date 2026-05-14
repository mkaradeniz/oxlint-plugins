---
name: oxlint-plugins
description: Publish the oxlint-plugins monorepo packages.
---

# Oxlint Plugins Publishing

1. Bump versions in `packages/whitespace/package.json` and `packages/react-structure/package.json`.
2. Run `pnpm install`, then `pnpm run verify`.
3. Commit the version bump and push `main`.
4. Wait for GitHub CI on `main` to pass before creating a release:
   `gh run list --repo mkaradeniz/oxlint-plugins --branch main --workflow CI --limit 1`
5. Create or confirm the publish environment:
   `gh api --method PUT repos/mkaradeniz/oxlint-plugins/environments/npm-publish`
6. Create a GitHub release:
   `gh release create vX.Y.Z --repo mkaradeniz/oxlint-plugins --title "vX.Y.Z" --notes "Release vX.Y.Z."`
7. Ensure npm Trusted Publishing is configured per package:
   - Repository: `mkaradeniz/oxlint-plugins`
   - Workflow filename: `publish.yml`
   - Environment: `npm-publish`

Only `packages/whitespace` and `packages/react-structure` publish. Their runtime dependency fields must use real npm versions, never `catalog:` or `workspace:`. Do not use npm tokens; publish via GitHub Actions OIDC.
