# Changesets

A changeset records a package release: which packages, which bump, and the changelog text.

- `pnpm changeset` writes one; commit it with the change it describes. It decides the bump and the
  changelog text of the next release.
- Without one, the release planner writes a patch changeset for every package whose published
  contents changed since npm's `latest` (a minor, on 0.x, when a dependency moved to another
  breaking line).
- Releases are made by a maintainer from a local checkout: the changesets are applied (versions,
  `CHANGELOG.md`), the packages published to npm, and the version commit pushed to `main`.
