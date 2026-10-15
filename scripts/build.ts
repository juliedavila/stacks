// Builds content/*.md into dist/ for GitHub Pages.
// Every entry ships twice: rendered HTML for people, raw Markdown for agents.
// Agents start at /llms.txt (or /index.json) and follow links to the .md files.
import { marked } from "marked";
import { readdir, mkdir, rm, copyFile } from "node:fs/promises";
import { join, basename, extname } from "node:path";

const ROOT = join(import.meta.dir, "..");
const CONTENT = join(ROOT, "content");
const DIST = join(ROOT, "dist");
const SITE_URL = (process.env.SITE_URL ?? "").replace(/\/$/, "");
const SITE_TITLE = "Stacks";
const SITE_SUMMARY =
  "Public research notes, diagrams and reference material, published for people and agents to read.";

type Entry = {
  slug: string;
  title: string;
  summary: string;
  date: string;
  tags: string[];
  body: string;
};

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return { meta, body: match[2] };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

const url = (path: string) => `${SITE_URL}/${path}`;

async function loadEntries(): Promise<Entry[]> {
  const files = (await readdir(CONTENT)).filter((f) => extname(f) === ".md");
  const entries: Entry[] = [];
  for (const file of files) {
    const { meta, body } = parseFrontmatter(await Bun.file(join(CONTENT, file)).text());
    const slug = basename(file, ".md");
    entries.push({
      slug,
      title: meta.title ?? slug,
      summary: meta.summary ?? "",
      date: meta.date ?? "",
      tags: (meta.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean),
      body,
    });
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

function page(title: string, description: string, main: string, rawLink?: string): string {
  const alternate = rawLink ? `<link rel="alternate" type="text/markdown" href="${rawLink}">` : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
${alternate}
<link rel="stylesheet" href="${url("style.css")}">
</head>
<body>
<header><a href="${url("")}">${SITE_TITLE}</a><nav><a href="${url("llms.txt")}">llms.txt</a><a href="${url("index.json")}">index.json</a></nav></header>
<main>${main}</main>
<script type="module">
  const blocks = document.querySelectorAll("code.language-mermaid");
  if (blocks.length) {
    const { default: mermaid } = await import("https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs");
    const dark = matchMedia("(prefers-color-scheme: dark)").matches;
    mermaid.initialize({ startOnLoad: false, theme: dark ? "dark" : "default" });
    blocks.forEach((code) => {
      const div = document.createElement("div");
      div.className = "mermaid";
      div.textContent = code.textContent;
      code.parentElement.replaceWith(div);
    });
    await mermaid.run();
  }
</script>
</body>
</html>`;
}

async function build() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  await copyFile(join(ROOT, "scripts", "style.css"), join(DIST, "style.css"));
  await Bun.write(join(DIST, ".nojekyll"), "");

  const entries = await loadEntries();

  for (const e of entries) {
    const raw = await Bun.file(join(CONTENT, `${e.slug}.md`)).text();
    await Bun.write(join(DIST, `${e.slug}.md`), raw);
    const meta = [e.date, ...e.tags.map((t) => `#${t}`)].filter(Boolean).join(" · ");
    const main = `<article>
<p class="meta">${escapeHtml(meta)} · <a href="${url(`${e.slug}.md`)}">raw markdown</a></p>
${await marked.parse(e.body)}
</article>`;
    await Bun.write(join(DIST, e.slug, "index.html"), page(e.title, e.summary, main, url(`${e.slug}.md`)));
  }

  const list = entries
    .map(
      (e) => `<li><a href="${url(`${e.slug}/`)}">${escapeHtml(e.title)}</a>
<span class="meta">${escapeHtml(e.date)}</span><p>${escapeHtml(e.summary)}</p></li>`,
    )
    .join("\n");
  const home = `<h1>${SITE_TITLE}</h1><p class="lede">${SITE_SUMMARY}</p>
<p class="agents">For agents: start at <a href="${url("llms.txt")}"><code>llms.txt</code></a> or <a href="${url("index.json")}"><code>index.json</code></a>. Every entry is also served as raw Markdown.</p>
<ul class="entries">${list || "<li>Nothing published yet.</li>"}</ul>`;
  await Bun.write(join(DIST, "index.html"), page(SITE_TITLE, SITE_SUMMARY, home));

  // llms.txt follows the llmstxt.org shape: H1, blockquote summary, link list.
  const llms = [
    `# ${SITE_TITLE}`,
    "",
    `> ${SITE_SUMMARY} Each link below is raw Markdown. The full corpus in one file is at ${url("llms-full.txt")}.`,
    "",
    "## Entries",
    "",
    ...entries.map((e) => `- [${e.title}](${url(`${e.slug}.md`)})${e.summary ? `: ${e.summary}` : ""}`),
    "",
  ].join("\n");
  await Bun.write(join(DIST, "llms.txt"), llms);

  const full = entries.map((e) => `# ${e.title}\n\nSource: ${url(`${e.slug}.md`)}\n\n${e.body.trim()}\n`).join("\n---\n\n");
  await Bun.write(join(DIST, "llms-full.txt"), full);

  const index = {
    title: SITE_TITLE,
    summary: SITE_SUMMARY,
    generated: new Date().toISOString(),
    entries: entries.map(({ body, ...e }) => ({ ...e, html: url(`${e.slug}/`), markdown: url(`${e.slug}.md`) })),
  };
  await Bun.write(join(DIST, "index.json"), JSON.stringify(index, null, 2));

  console.log(`built ${entries.length} entries → dist/`);
}

await build();
