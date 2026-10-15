# Stacks

Public research notes, diagrams and reference material, published as a static GitHub Pages site that people and agents can both read.

Everything here is public knowledge. If it shouldn't be on the open internet, it doesn't go in `content/`.

## Pointing an agent at it

Give the agent the site's `llms.txt`. It lists every entry with a link to its raw Markdown.

- `/llms.txt`: index of entries, one raw-Markdown link each ([llmstxt.org](https://llmstxt.org) shape)
- `/llms-full.txt`: every entry concatenated into one file
- `/index.json`: the same index as JSON (title, summary, date, tags, html and markdown URLs)
- `/<slug>.md`: one entry as raw Markdown
- `/<slug>/`: one entry rendered for people

## Publishing

```sh
bun run publish path/to/note.md --summary "One line on what it is" --tags ai,security
```

That copies the file into `content/`, adds frontmatter if it has none, runs the guard, rebuilds, commits and pushes. GitHub Actions deploys in about a minute. Flags: `--title`, `--slug`, `--dry-run`, `--no-push`.

Diagrams go inside the Markdown as a ```` ```mermaid ```` block (rendered on the page, readable as source by agents) or as inline SVG.

## The guard

`bun run check` scans `content/`. It runs in CI too, so a bad commit fails the deploy rather than shipping.

It has two layers. Built-in patterns catch credentials, local home paths and private IP addresses. A personal term denylist at `~/.config/stacks/denylist.txt` catches anything else you never want published; it lives outside the repo because a public list of forbidden words publishes the words. One term per line, `#` for comments, `/regex/flags` for patterns. CI only has the built-in layer, so the personal one only protects publishes from a machine that has the file.
