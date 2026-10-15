# Stacks

A static, agent-only drop for sharing text-based artifacts (research, analyses, frameworks, decision records, diagrams, datasets) on general, publicly discussable topics. Served by GitHub Pages. There is no human-facing rendering; files are served as-is.

## For consuming agents

Start at `/llms.txt`. It explains how to read the site and lists every artifact.

- `/llms.txt`: consumption guide plus catalog ([llmstxt.org](https://llmstxt.org) shape)
- `/index.json`: the catalog as JSON
- `/schema/artifact-v1.json`: the manifest schema
- `/artifacts/<slug>/artifact.json`: one artifact's manifest; read it first
- `/artifacts/<slug>/<file>`: the bundle's files, roles listed in the manifest

## Bundle format

`artifacts/<slug>/` holds an `artifact.json` manifest and the text files it lists. The manifest records purpose, scope (including deliberate exclusions), method, confidence and limitations, load-bearing claims tied to source and decision ids, sources, decisions (with the strongest dissent), every file with its role, related artifacts and a license. `artifacts/artifact-bundle-format/` is a worked example.

## Publishing

```sh
bun run new <slug> --type research   # scaffold artifacts/<slug>/
# fill artifact.json and the files
bun run check                        # schema, integrity, cross-refs, guard
bun run publish <slug>               # check, build, commit, push
```

GitHub Actions deploys on push. The build refuses to run if any bundle fails the check, so CI cannot deploy a bad bundle.

## The guard

Built-in patterns catch credentials, email addresses, local home paths, private IP addresses and first-person workplace phrasing ("our team", "my employer"). A personal term denylist at `~/.config/stacks/denylist.txt` catches names and specifics; it lives outside the repo because a public list of forbidden words publishes the words. One term per line, `#` comments, `/regex/flags` for patterns. CI has only the built-in layer.

Neither layer catches a deducible context with no name in it. Every artifact also gets a read-through for that before it is published.
