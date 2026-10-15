// bun run publish <file.md> [--title T] [--summary S] [--tags a,b] [--slug s] [--dry-run] [--no-push]
// Copies a Markdown file into content/, adds frontmatter if missing, runs the guard,
// rebuilds, commits, and pushes. GitHub Actions deploys on push.
import { parseArgs } from "node:util";
import { join, basename, extname } from "node:path";
import { guard } from "./guard";

const ROOT = join(import.meta.dir, "..");

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
  options: {
    title: { type: "string" },
    summary: { type: "string" },
    tags: { type: "string" },
    slug: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    "no-push": { type: "boolean", default: false },
  },
});

const src = positionals[0];
if (!src) {
  console.error("usage: bun run publish <file.md> [--title T] [--summary S] [--tags a,b] [--slug s] [--dry-run] [--no-push]");
  process.exit(1);
}
if (extname(src) !== ".md") {
  console.error(`only .md files are published (got ${src}); put diagrams in a mermaid or svg block inside one`);
  process.exit(1);
}

const raw = await Bun.file(src).text();
const hasFrontmatter = raw.startsWith("---\n");
const firstHeading = raw.match(/^#\s+(.+)$/m)?.[1]?.trim();
const slug = (values.slug ?? basename(src, ".md"))
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

let out = raw;
if (!hasFrontmatter) {
  const fm = [
    "---",
    `title: ${values.title ?? firstHeading ?? slug}`,
    `summary: ${values.summary ?? ""}`,
    `date: ${new Date().toISOString().slice(0, 10)}`,
    `tags: ${values.tags ?? ""}`,
    "---",
    "",
  ].join("\n");
  out = fm + raw;
}

// Scan the final text (CLI-supplied frontmatter can leak too), but report source line numbers.
const offset = out.split("\n").length - raw.split("\n").length;
const findings = await guard(out);
if (findings.length) {
  console.error(`refusing to publish ${src}: ${findings.length} guard finding(s)`);
  for (const f of findings) {
    const where = f.line > offset ? `line ${f.line - offset}` : "frontmatter";
    console.error(`  ${where}: ${f.rule} → ${f.excerpt}`);
  }
  process.exit(2);
}

const dest = join(ROOT, "content", `${slug}.md`);
const exists = await Bun.file(dest).exists();
if (values["dry-run"]) {
  console.log(`dry run: guard clean, would ${exists ? "update" : "add"} content/${slug}.md`);
  process.exit(0);
}
await Bun.write(dest, out);

const run = (cmd: string[]) => {
  const p = Bun.spawnSync(cmd, { cwd: ROOT, stdout: "inherit", stderr: "inherit" });
  if (p.exitCode !== 0) process.exit(p.exitCode ?? 1);
};
run(["bun", "scripts/build.ts"]);
run(["git", "add", `content/${slug}.md`]);
run(["git", "commit", "-q", "-m", `docs(content): ${exists ? "update" : "add"} ${slug}`]);

const hasRemote = Bun.spawnSync(["git", "remote"], { cwd: ROOT }).stdout.toString().trim().length > 0;
if (values["no-push"] || !hasRemote) {
  console.log(`committed content/${slug}.md (not pushed${hasRemote ? "" : ": no remote configured"})`);
} else {
  run(["git", "push", "-q"]);
  console.log(`pushed content/${slug}.md; live in about a minute at <site>/${slug}/ and <site>/${slug}.md`);
}
