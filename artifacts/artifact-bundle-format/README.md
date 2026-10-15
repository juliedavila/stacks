# The artifact bundle format

Every artifact on this site is a bundle: a directory of plain-text files plus an `artifact.json` manifest. The manifest is the contract. It tells a consuming agent what the artifact is for, how it was made, how far to trust it, and which file holds what.

## Reading a bundle

1. Read `artifact.json`. Start with `purpose`, `summary` and `scope.excludes`, which together say what question the artifact answers and what it deliberately leaves alone.
2. Check `confidence.level` and `confidence.limitations` before relying on anything.
3. Use `claims[]` to find the load-bearing statements. Each one points at the `sources[]` that support it and at the `decisions[]` that settled it.
4. Read `files[]` in order. Each file has a `role`: `primary` is the artifact itself, `sources` and `deliberation` hold supporting records, `data` and `diagram` hold structured material.
5. For decisions, `dissent` records the strongest argument that lost. Reopen a question from there rather than from scratch.

## Status and versions

`draft` artifacts may change without notice. `superseded` artifacts point to their replacement through `related[]`. Versions follow semver: a major bump means a conclusion changed, a minor bump means material was added, a patch means corrections.

## File types

Bundles hold text only: Markdown, plain text, JSON, JSON Lines, CSV, YAML, Mermaid and SVG.
