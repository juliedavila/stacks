// Pre-publish guard. Two layers:
//  1. Built-in patterns (secrets, local paths, private addresses), committed here, safe to be public.
//  2. A personal term denylist at ~/.config/stacks/denylist.txt, deliberately NOT in this repo,
//     because a public list of forbidden words publishes the words.
// bundle.ts runs it over every file in a bundle, artifact.json included.
import { join } from "node:path";
import { homedir } from "node:os";

export type Finding = { line: number; rule: string; excerpt: string };

const BUILT_IN: [string, RegExp][] = [
  ["aws-access-key", /\bAKIA[0-9A-Z]{16}\b/],
  ["github-token", /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ["gitlab-token", /\bglpat-[A-Za-z0-9_-]{20,}\b/],
  ["anthropic-key", /\bsk-ant-[A-Za-z0-9_-]{20,}\b/],
  ["openai-key", /\bsk-[A-Za-z0-9]{32,}\b/],
  ["slack-token", /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ["private-key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["jwt", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ["local-home-path", /\/Users\/[a-z0-9._-]+\/|\/home\/[a-z0-9._-]+\//i],
  ["private-ipv4", /\b(10\.\d{1,3}|192\.168|172\.(1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/],
  ["email-address", /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/],
  // Artifacts speak about a topic in general terms, never from inside an organization.
  ["workplace-reference", /\b(our|my) (team|teams|org|organization|company|employer|bank|firm|ciso|cto|manager|boss|leadership|security org|environment|stack)\b|\b(at work|internally|in-house|my job|our customers)\b/i],
];

const DENYLIST = process.env.STACKS_DENYLIST ?? join(homedir(), ".config", "stacks", "denylist.txt");

async function personalRules(): Promise<[string, RegExp][]> {
  const file = Bun.file(DENYLIST);
  if (!(await file.exists())) return [];
  return (await file.text())
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((term) => {
      // A line wrapped in slashes is a regex; anything else is a case-insensitive literal.
      const re = term.startsWith("/") && term.lastIndexOf("/") > 0
        ? new RegExp(term.slice(1, term.lastIndexOf("/")), term.slice(term.lastIndexOf("/") + 1) || "i")
        : new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      return ["denylist", re] as [string, RegExp];
    });
}

export async function guard(text: string): Promise<Finding[]> {
  const rules = [...BUILT_IN, ...(await personalRules())];
  const findings: Finding[] = [];
  text.split("\n").forEach((line, i) => {
    for (const [rule, re] of rules) {
      const m = line.match(re);
      if (m) findings.push({ line: i + 1, rule, excerpt: m[0].slice(0, 12) + (m[0].length > 12 ? "…" : "") });
    }
  });
  return findings;
}
