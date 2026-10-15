// bun run publish <slug> [--no-push]
// Checks artifacts/<slug>/, rebuilds, commits the bundle, pushes. GitHub Actions deploys on push.
import { parseArgs } from "node:util";
import { ROOT, loadBundle } from "./bundle";

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
  options: { "no-push": { type: "boolean", default: false } },
});

const slug = positionals[0];
if (!slug) {
  console.error("usage: bun run publish <slug> [--no-push]   (scaffold one first with: bun run new <slug>)");
  process.exit(1);
}

const bundle = await loadBundle(slug);
if (bundle.problems.length) {
  console.error(`refusing to publish ${slug}: ${bundle.problems.length} problem(s)`);
  for (const p of bundle.problems) console.error(`  ${p}`);
  process.exit(2);
}

const run = (cmd: string[]) => {
  const p = Bun.spawnSync(cmd, { cwd: ROOT, stdout: "inherit", stderr: "inherit" });
  if (p.exitCode !== 0) process.exit(p.exitCode ?? 1);
};
const isNew = Bun.spawnSync(["git", "ls-files", `artifacts/${slug}/artifact.json`], { cwd: ROOT }).stdout.toString().trim() === "";

run(["bun", "scripts/build.ts"]);
run(["git", "add", "-A", `artifacts/${slug}`]);
run(["git", "commit", "-q", "-m", `docs(artifacts): ${isNew ? "add" : "update"} ${slug} v${bundle.manifest.version}`]);

const hasRemote = Bun.spawnSync(["git", "remote"], { cwd: ROOT }).stdout.toString().trim().length > 0;
if (values["no-push"] || !hasRemote) {
  console.log(`committed ${slug} (not pushed${hasRemote ? "" : ": no remote configured"})`);
} else {
  run(["git", "push", "-q"]);
  console.log(`pushed ${slug}; live in about a minute at <site>/artifacts/${slug}/artifact.json`);
}
