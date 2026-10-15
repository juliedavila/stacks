// Loads and checks artifact bundles. A bundle is artifacts/<slug>/ holding artifact.json
// plus the text files it lists. Checks: schema, file integrity, cross-references, guard.
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { guard } from "./guard";

export const ROOT = join(import.meta.dir, "..");
export const ARTIFACTS = join(ROOT, "artifacts");

const schema = await Bun.file(join(ROOT, "schema", "artifact-v1.json")).json();
const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

export type Manifest = {
  slug: string;
  title: string;
  type: string;
  purpose: string;
  summary: string;
  status: string;
  version: string;
  created: string;
  updated?: string;
  tags?: string[];
  files: { path: string; role: string; description: string }[];
  claims?: { id: string; sources?: string[]; decision?: string }[];
  sources?: { id: string }[];
  decisions?: { id: string; file?: string }[];
  related?: { slug: string }[];
  [k: string]: unknown;
};

export type Bundle = { slug: string; dir: string; manifest: Manifest; problems: string[] };

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name !== ".DS_Store") out.push(p);
  }
  return out;
}

export async function slugs(): Promise<string[]> {
  return (await readdir(ARTIFACTS, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

export async function loadBundle(slug: string): Promise<Bundle> {
  const dir = join(ARTIFACTS, slug);
  const problems: string[] = [];
  const manifestFile = Bun.file(join(dir, "artifact.json"));
  if (!(await manifestFile.exists())) return { slug, dir, manifest: {} as Manifest, problems: ["missing artifact.json"] };

  let manifest: Manifest;
  try {
    manifest = await manifestFile.json();
  } catch (e) {
    return { slug, dir, manifest: {} as Manifest, problems: [`artifact.json is not valid JSON: ${(e as Error).message}`] };
  }

  if (!validate(manifest)) {
    for (const err of validate.errors ?? []) problems.push(`schema: ${err.instancePath || "/"} ${err.message}`);
  }
  if (manifest.slug !== slug) problems.push(`slug "${manifest.slug}" does not match directory "${slug}"`);

  const files = manifest.files ?? [];
  const listed = new Set(files.map((f) => f.path));
  const onDisk = (await walk(dir)).map((p) => relative(dir, p)).filter((p) => p !== "artifact.json");
  for (const p of onDisk) if (!listed.has(p)) problems.push(`unlisted file ${p} (add it to files[] or remove it)`);
  for (const p of listed) if (!onDisk.includes(p)) problems.push(`files[] lists ${p} but it does not exist`);
  if (files.filter((f) => f.role === "primary").length !== 1) problems.push("files[] needs exactly one role: primary");

  const sourceIds = new Set((manifest.sources ?? []).map((s) => s.id));
  const decisionIds = new Set((manifest.decisions ?? []).map((d) => d.id));
  for (const c of manifest.claims ?? []) {
    for (const s of c.sources ?? []) if (!sourceIds.has(s)) problems.push(`claim ${c.id} cites unknown source ${s}`);
    if (c.decision && !decisionIds.has(c.decision)) problems.push(`claim ${c.id} cites unknown decision ${c.decision}`);
  }
  for (const d of manifest.decisions ?? []) if (d.file && !listed.has(d.file)) problems.push(`decision ${d.id} points at unlisted file ${d.file}`);

  // Guard every text file, the manifest included.
  for (const p of ["artifact.json", ...onDisk]) {
    for (const f of await guard(await Bun.file(join(dir, p)).text())) {
      problems.push(`guard: ${p}:${f.line} ${f.rule} → ${f.excerpt}`);
    }
  }

  return { slug, dir, manifest, problems };
}

export async function checkAll(): Promise<Bundle[]> {
  const bundles = await Promise.all((await slugs()).map(loadBundle));
  const known = new Set(bundles.map((b) => b.slug));
  for (const b of bundles) {
    for (const r of b.manifest.related ?? []) if (!known.has(r.slug)) b.problems.push(`related slug ${r.slug} is not published`);
  }
  return bundles;
}

if (import.meta.main) {
  const bundles = await checkAll();
  let bad = 0;
  for (const b of bundles) {
    for (const p of b.problems) console.error(`${b.slug}: ${p}`);
    if (b.problems.length) bad++;
  }
  console.log(`check: ${bundles.length} bundle(s), ${bad} with problems`);
  process.exit(bad ? 2 : 0);
}
