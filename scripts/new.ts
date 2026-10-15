// bun run new <slug> [--type research] [--title T]
// Scaffolds artifacts/<slug>/ with a manifest skeleton and a primary file. Fill both, then publish.
import { parseArgs } from "node:util";
import { join } from "node:path";
import { ARTIFACTS } from "./bundle";

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
  options: { type: { type: "string", default: "research" }, title: { type: "string" } },
});

const slug = positionals[0];
if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  console.error("usage: bun run new <kebab-case-slug> [--type research] [--title T]");
  process.exit(1);
}
const dir = join(ARTIFACTS, slug);
if (await Bun.file(join(dir, "artifact.json")).exists()) {
  console.error(`artifacts/${slug} already exists`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const manifest = {
  schema: "stacks/artifact@1",
  slug,
  title: values.title ?? slug,
  type: values.type,
  purpose: "TODO: the question this answers or the job it does",
  summary: "TODO: the conclusion in a few sentences",
  audience: "",
  status: "draft",
  version: "0.1.0",
  created: today,
  scope: { covers: [], excludes: [] },
  method: { summary: "TODO: how it was produced", steps: [] },
  confidence: { level: "medium", limitations: [], open_questions: [] },
  claims: [],
  sources: [],
  decisions: [],
  files: [{ path: "README.md", role: "primary", description: "The artifact itself." }],
  related: [],
  tags: [],
  license: "CC-BY-4.0",
};
await Bun.write(join(dir, "artifact.json"), JSON.stringify(manifest, null, 2) + "\n");
await Bun.write(join(dir, "README.md"), `# ${manifest.title}\n\nTODO\n`);
console.log(`scaffolded artifacts/${slug}/ (artifact.json, README.md); publish with: bun run publish ${slug}`);
