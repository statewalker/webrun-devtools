# Changesets

A changeset records a package release: which packages, which bump, and the changelog text.

- `pnpm changeset` writes one; commit it with the change it describes. It decides the bump and the
  changelog text of the next release.
- Without one, the release planner writes a patch changeset for every package whose published
  contents changed since npm's `latest` (a minor, on 0.x, when a dependency moved to another
  breaking line).
- Releases go through CI only. After CI passes on `main`, a job applies the changesets in a
  "chore: version packages" pull request (versions, `CHANGELOG.md`); merging it publishes the
  bumped packages to npm at once, with trusted publishing and provenance. Do not run
  `changeset version` or `changeset publish`, or publish to npm, from a local checkout. The one
  exception is a new package's first version: npm accepts trusted publishing only for a package
  that exists, so the maintainer publishes it by hand, with 2FA, before the version pull request
  that releases it merges.
