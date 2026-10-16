// bun run stage <slug> <file-or-dir>... [--type research] [--title T] [--force]
// Copies sources into artifacts/<slug>/ and drafts the manifest's files[] from what landed.
// Never touches the sources. Refuses anything that is not plain text, including code:
// consumers would run it, which makes this a software-distribution channel. Text only.
import { parseArgs } from "node:util";
import { join, basename, extname, relative } from "node:path";
import { readdir, stat, mkdir, copyFile } from "node:fs/promises";
import { ARTIFACTS } from "./bundle";

const ALLOWED = new Set([".md", ".txt", ".json", ".jsonl", ".csv", ".yaml", ".yml", ".svg"]);
const SKIP = new Set([".DS_Store", ".git", "node_modules"]);

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
  options: {
    type: { type: "string" },
    title: { type: "string" },
    force: { type: "boolean", default: false },
  },
});

const [slug, ...sources] = positionals;
if (!slug || !sources.length || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  console.error("usage: bun run stage <kebab-slug> <file-or-dir>... [--type research] [--title T] [--force]");
  process.exit(1);
}

const dir = join(ARTIFACTS, slug);
const manifestPath = join(dir, "artifact.json");
const existing = (await Bun.file(manifestPath).exists()) ? await Bun.file(manifestPath).json() : null;

// Collect [absolute source, bundle-relative destination] pairs.
const pairs: [string, string][] = [];
const refused: string[] = [];
async function collect(src: string, base: string) {
  const s = await stat(src);
  if (s.isDirectory()) {
    for (const e of await readdir(src)) if (!SKIP.has(e)) await collect(join(src, e), base);
    return;
  }
  const rel = relative(base, src) || basename(src);
  if (!ALLOWED.has(extname(src).toLowerCase())) refused.push(rel);
  else pairs.push([src, rel.replace(/\s+/g, "-")]);
}
for (const src of sources) {
  const s = await stat(src).catch(() => null);
  if (!s) {
    console.error(`no such file or directory: ${src}`);
    process.exit(1);
  }
  await collect(src, s.isDirectory() ? src : join(src, ".."));
}

if (refused.length) {
  console.error(`refusing ${refused.length} non-text or executable file(s); stage only the text, or convert it:`);
  for (const r of refused) console.error(`  ${r}`);
  process.exit(2);
}

for (const [, dest] of pairs) {
  if (!values.force && (await Bun.file(join(dir, dest)).exists())) {
    console.error(`artifacts/${slug}/${dest} already exists; pass --force to overwrite`);
    process.exit(1);
  }
}
for (const [src, dest] of pairs) {
  await mkdir(join(dir, dest, ".."), { recursive: true });
  await copyFile(src, join(dir, dest));
}

// Draft files[]: keep descriptions for paths already listed, add new paths with a TODO.
type FileEntry = { path: string; role: string; description: string };
const prior: FileEntry[] = existing?.files ?? [];
const known = new Map(prior.map((f) => [f.path, f]));
const isPrimary = (p: string) => /(^|\/)(SKILL|README)\.md$/i.test(p);
const added: FileEntry[] = pairs
  .map(([, p]) => p)
  .filter((p) => !known.has(p))
  .map((p) => ({ path: p, role: "appendix", description: "TODO" }));
const files = [...prior, ...added];
if (!files.some((f) => f.role === "primary")) {
  const pick = files.find((f) => isPrimary(f.path)) ?? files.find((f) => f.path.endsWith(".md")) ?? files[0];
  if (pick) pick.role = "primary";
}
files.sort((a, b) => (a.role === "primary" ? -1 : b.role === "primary" ? 1 : 0));

const today = new Date().toISOString().slice(0, 10);
const manifest = existing ?? {
  schema: "stacks/artifact@1",
  slug,
  title: values.title ?? slug,
  type: values.type ?? "research",
  purpose: "TODO",
  summary: "TODO",
  audience: "",
  status: "draft",
  version: "0.1.0",
  created: today,
  scope: { covers: [], excludes: [] },
  method: { summary: "TODO", steps: [] },
  confidence: { level: "medium", limitations: [], open_questions: [] },
  claims: [],
  sources: [],
  decisions: [],
  files: [],
  related: [],
  tags: [],
  license: "CC-BY-4.0",
};
manifest.files = files;
if (existing) manifest.updated = today;
await Bun.write(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

console.log(`staged ${pairs.length} file(s) into artifacts/${slug}/ (${added.length} new in files[])`);
for (const f of files) console.log(`  ${f.role.padEnd(12)} ${f.path}${f.description === "TODO" ? "  ← describe" : ""}`);
console.log("next: sanitize the copies, fill every TODO in artifact.json, then bun run verify " + slug);
