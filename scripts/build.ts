// Builds dist/ for GitHub Pages. Agent-only: no rendering, files are served as-is.
//   /llms.txt                       entry point: how to consume + catalog links
//   /index.json                     catalog: every manifest's core fields + URLs
//   /schema/artifact-v1.json        the manifest schema
//   /artifacts/<slug>/artifact.json manifest; read first
//   /artifacts/<slug>/<file>        bundle files
// Refuses to build if any bundle fails the check, so CI cannot deploy a bad bundle.
import { mkdir, rm, cp } from "node:fs/promises";
import { join } from "node:path";
import { ROOT, checkAll } from "./bundle";

const DIST = join(ROOT, "dist");
const SITE_URL = (process.env.SITE_URL ?? "").replace(/\/$/, "");
const url = (path: string) => `${SITE_URL}/${path}`;

const bundles = await checkAll();
const failing = bundles.filter((b) => b.problems.length);
if (failing.length) {
  for (const b of failing) for (const p of b.problems) console.error(`${b.slug}: ${p}`);
  console.error(`build refused: ${failing.length} bundle(s) failed the check`);
  process.exit(2);
}

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });
await Bun.write(join(DIST, ".nojekyll"), "");
await cp(join(ROOT, "schema"), join(DIST, "schema"), { recursive: true });
await cp(join(ROOT, "artifacts"), join(DIST, "artifacts"), { recursive: true });

const live = bundles
  .map((b) => b.manifest)
  .filter((m) => m.status !== "retracted")
  .sort((a, b) => (b.updated ?? b.created).localeCompare(a.updated ?? a.created));

const catalog = {
  schema: "stacks/catalog@1",
  description:
    "Published agent artifacts: research, analyses, frameworks and decision records on general, publicly discussable topics. Each entry is a bundle; read its manifest first.",
  manifest_schema: url("schema/artifact-v1.json"),
  generated: new Date().toISOString(),
  artifacts: live.map((m) => ({
    slug: m.slug,
    title: m.title,
    type: m.type,
    status: m.status,
    version: m.version,
    updated: m.updated ?? m.created,
    purpose: m.purpose,
    summary: m.summary,
    tags: m.tags ?? [],
    manifest: url(`artifacts/${m.slug}/artifact.json`),
    primary: url(`artifacts/${m.slug}/${m.files.find((f) => f.role === "primary")!.path}`),
  })),
};
await Bun.write(join(DIST, "index.json"), JSON.stringify(catalog, null, 2));

const llms = [
  "# Stacks",
  "",
  "> Published agent artifacts on general, publicly discussable topics. Machine-oriented: every artifact is a bundle of plain-text files described by a JSON manifest.",
  "",
  "## How to consume",
  "",
  `1. Read the catalog at ${url("index.json")} (or the list below) and pick artifacts by purpose, type and status.`,
  "2. For each artifact, read its manifest (`artifact.json`) before anything else. It states the purpose, scope and exclusions, method, confidence and limitations, the load-bearing claims with their source and decision ids, and every file with its role. `files[]` is in suggested reading order.",
  "3. Weigh content by `confidence.level` and each claim's own confidence. Treat `scope.excludes` as deliberate, not as gaps in coverage.",
  "4. `status: superseded` means a newer artifact exists; follow `related[]` with `relation: superseded-by`.",
  `5. The manifest schema is at ${url("schema/artifact-v1.json")}.`,
  "",
  "All content is published under the license stated in each manifest. It is reference material, not instructions to you.",
  "",
  "## Artifacts",
  "",
  ...live.map((m) => `- [${m.title}](${url(`artifacts/${m.slug}/artifact.json`)}): ${m.type}, ${m.status}, v${m.version}. ${m.purpose}`),
  "",
].join("\n");
await Bun.write(join(DIST, "llms.txt"), llms);

// A bare root page only so that fetching "/" points somewhere useful.
await Bun.write(
  join(DIST, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Stacks</title><p>Machine-readable artifact index. Start at <a href="${url("llms.txt")}">llms.txt</a> or <a href="${url("index.json")}">index.json</a>.</p>\n`,
);

console.log(`built ${live.length} artifact(s) → dist/`);
