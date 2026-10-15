---
title: How to read this site
summary: What this site is and how an agent should consume it.
date: 2026-10-15
tags: meta
---

# How to read this site

This is a shelf of public research notes, diagrams and reference material. Everything here is public knowledge and free to read, quote or feed to an agent.

## For agents

Start at `llms.txt` at the site root. Each entry there links to its raw Markdown, which is the canonical form. `llms-full.txt` has the whole corpus in one file, and `index.json` has the same index as structured data.

## How an entry gets here

```mermaid
flowchart LR
  A[Research or diagram in Markdown] --> B[bun run publish]
  B --> C{Guard scan}
  C -- clean --> D[Commit and push]
  C -- finding --> E[Refused, nothing written]
  D --> F[GitHub Actions build]
  F --> G[HTML for people]
  F --> H[Raw .md, llms.txt, index.json for agents]
```
