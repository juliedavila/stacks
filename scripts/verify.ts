// bun run verify <slug>          before publishing: bundle check, no TODOs left, every source URL resolves
// bun run verify <slug> --live   after publishing: every published file is served, as text, matching local
import { parseArgs } from "node:util";
import { join } from "node:path";
import { loadBundle } from "./bundle";

const SITE = (process.env.STACKS_SITE ?? "https://juliedavila.github.io/stacks").replace(/\/$/, "");

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
  options: { live: { type: "boolean", default: false } },
});
const slug = positionals[0];
if (!slug) {
  console.error("usage: bun run verify <slug> [--live]");
  process.exit(1);
}

const b = await loadBundle(slug);
const problems = [...b.problems];
const ok = (msg: string) => console.log(`  ok    ${msg}`);

if (!values.live) {
  const manifestText = await Bun.file(join(b.dir, "artifact.json")).text();
  const todos = manifestText.match(/TODO/g)?.length ?? 0;
  if (todos) problems.push(`artifact.json still has ${todos} TODO(s)`);
  for (const f of b.manifest.files ?? []) {
    if (/TODO/.test(await Bun.file(join(b.dir, f.path)).text())) problems.push(`${f.path} still contains TODO`);
  }

  const sources = (b.manifest.sources ?? []) as { id: string; url?: string }[];
  await Promise.all(
    sources.filter((s) => s.url).map(async (s) => {
      try {
        let r = await fetch(s.url!, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(15000) });
        if (r.status === 405 || r.status === 403) r = await fetch(s.url!, { redirect: "follow", signal: AbortSignal.timeout(15000) });
        if (r.ok) ok(`${s.id} ${s.url} → ${r.status}`);
        else problems.push(`${s.id} ${s.url} → HTTP ${r.status}`);
      } catch (e) {
        problems.push(`${s.id} ${s.url} → ${(e as Error).message}`);
      }
    }),
  );
} else {
  const paths = ["artifact.json", ...(b.manifest.files ?? []).map((f) => f.path)];
  for (const p of paths) {
    const u = `${SITE}/artifacts/${slug}/${p}`;
    const r = await fetch(u, { signal: AbortSignal.timeout(15000) }).catch((e) => e as Error);
    if (r instanceof Error) {
      problems.push(`${u} → ${r.message}`);
      continue;
    }
    const type = r.headers.get("content-type") ?? "";
    if (!r.ok) problems.push(`${u} → HTTP ${r.status}`);
    else if (!/^(text\/|application\/json|image\/svg)/.test(type)) problems.push(`${u} served as ${type}; agents may treat it as binary`);
    else if ((await r.text()) !== (await Bun.file(join(b.dir, p)).text())) problems.push(`${u} differs from local; deploy may still be running`);
    else ok(`${p} (${type.split(";")[0]})`);
  }
  for (const idx of ["llms.txt", "index.json"]) {
    const text = await fetch(`${SITE}/${idx}`).then((r) => r.text()).catch(() => "");
    if (text.includes(`artifacts/${slug}/artifact.json`)) ok(`listed in ${idx}`);
    else problems.push(`not listed in ${idx}`);
  }
}

for (const p of problems) console.error(`  FAIL  ${p}`);
console.log(`verify${values.live ? " --live" : ""} ${slug}: ${problems.length ? `${problems.length} problem(s)` : "clean"}`);
process.exit(problems.length ? 2 : 0);
