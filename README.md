# demo-spec-publishing

A demo Task Manager OpenAPI spec, published as a static, versioned docs
site so it can be shared via a link and evolved over time.

## Site structure

Published output lives on the `gh-pages` branch (never on `main`):

```
gh-pages/
├── index.html        # landing page listing all published versions
├── versions.json      # machine-readable manifest: { latest, versions[] }
├── latest/             # always mirrors the newest stable version
│   └── index.html
├── 1.0.0/               # immutable once published
│   └── index.html
└── 1.1.0/
    └── index.html
```

Every published version stays live forever at its own URL. Nothing on
`gh-pages` is ever overwritten except `latest/`, `versions.json`, and the
landing `index.html`.

## Shareable links

- Always current: `https://iwt-marceleffinger.github.io/demo-spec-publishing/latest/`
- Pinned to a specific version: `https://iwt-marceleffinger.github.io/demo-spec-publishing/<version>/`
  (e.g. `.../1.0.0/`)

## Adding or changing an endpoint

1. Edit `spec/openapi.yaml` (follow the existing patterns for tags,
   reusable `components/schemas`, and examples).
2. Run `npm run lint` to catch schema errors early.

## Previewing locally

```
npm install
npm run preview
```

This lints the spec, renders it with Redoc into `dist/index.html`, and
serves it at `http://localhost:5000`.

## Cutting a release

Published versions are **immutable** — if you need to fix a mistake in a
published version, publish a new patch version rather than re-tagging.

1. Bump `info.version` in `spec/openapi.yaml` (e.g. `1.0.0` -> `1.1.0`).
2. Commit and push to `main`:
   ```
   git add spec/openapi.yaml
   git commit -m "Add task assignee field, bump to 1.1.0"
   git push origin main
   ```
3. Tag and push the release:
   ```
   git tag v1.1.0
   git push origin v1.1.0
   ```

Pushing the tag triggers `.github/workflows/release.yml`, which lints the
spec, verifies the tag matches `info.version`, builds the Redoc docs, and
publishes them to `gh-pages` alongside every previously published version.

## Troubleshooting CI failures

- **"does not match spec/openapi.yaml info.version"**: the git tag doesn't
  match `info.version`. Bump the version in the spec (or fix the tag) and
  re-tag.
- **"is already published"**: that exact version was already released.
  Bump `info.version` to a new value and cut a new tag — you cannot
  republish an existing version.
