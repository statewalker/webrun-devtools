# Changesets

A changeset records a package release: which packages, which bump, and the changelog text.

- `pnpm changeset` writes one; commit it with the change it describes.
- Without one, the release job writes a patch changeset for every package whose published contents
  changed (a minor, on 0.x, when a dependency moved to another breaking line).
- On `main`, pending changesets become the "chore: version packages" pull request; merging it
  publishes the packages to npm.
