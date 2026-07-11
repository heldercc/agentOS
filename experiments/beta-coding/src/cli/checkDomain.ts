// Enforces ADR-0008 for the beta: the engine (src/) must contain no domain
// vocabulary. The subject of the experiment lives only in data/. Scans every
// src/*.ts (except this file) for any banned word from data/banned-words.json.

import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync, statSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(HERE, "..", "..");
const SRC_DIR = resolve(PKG_ROOT, "src");
const BANNED_FILE = resolve(PKG_ROOT, "data", "banned-words.json");
const SELF = fileURLToPath(import.meta.url);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = resolve(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

function main(): void {
  const banned: string[] = JSON.parse(readFileSync(BANNED_FILE, "utf8")).words;
  const patterns = banned.map((w) => ({
    word: w,
    re: new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
  }));

  const hits: string[] = [];
  for (const file of walk(SRC_DIR)) {
    if (resolve(file) === SELF) continue; // this checker names the words legitimately
    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const { word, re } of patterns) {
        if (re.test(line)) {
          hits.push(`${relative(PKG_ROOT, file)}:${i + 1}: domain word "${word}"`);
        }
      }
    });
  }

  if (hits.length === 0) {
    console.log(`check:domain: OK — engine is domain-blind (${patterns.length} words checked)`);
    return;
  }
  console.error("check:domain: FAILED — domain vocabulary leaked into the engine");
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}

main();
