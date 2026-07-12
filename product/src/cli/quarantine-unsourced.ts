// PHASE 7D immediate (ADR-0022): the Reference Guild preload shipped 20
// candidate seeds authored WITHOUT primary sources, and their labels read
// as if they were established reference material. The CEO decision:
// correct misleading labels and QUARANTINE unsourced preload candidates —
// never call them validated or state of the art until real research
// (sources, exact claims, dates, confidence, licenses) and the Pilot's
// admission happen.
//
// Also classifies (RULE A) any candidate whose source_project was a
// scripted/verification run, so it never reads as learning from a real
// project of the Pilot's.
//
// Governed, idempotent, evidence-preserving: touches ONLY provenance
// labelling on records still in candidates/ (nothing admitted, nothing
// deleted, rule/why untouched). Run:
//   npx tsx src/cli/quarantine-unsourced.ts

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";

import { hiDir } from "../hi.js";

const QUARANTINE_MARK = "QUARENTENA (ADR-0022 PHASE 7D)";
const SCRIPTED_MARK = "origem SCRIPTED (RULE A)";
/** Scripted/verification runs whose records were reclassified in PHASE 1.2. */
const SCRIPTED_PROJECTS = new Set(["smoke-loop", "smoke-enough", "verify-observability"]);

const candidatesDir = resolve(hiDir(), "candidates");
let quarantined = 0;
let classified = 0;
let untouched = 0;

for (const name of readdirSync(candidatesDir).filter((n) => n.endsWith(".yaml")).sort()) {
  const path = resolve(candidatesDir, name);
  const rec = YAML.parse(readFileSync(path, "utf8").replace(/^﻿/, ""));
  const prov = rec?.provenance ?? {};
  let changed = false;

  if (prov.origin === "imported" && rec.owner === "agentos-base" &&
      !String(prov.note ?? "").includes(QUARANTINE_MARK)) {
    prov.research = "unsourced";
    prov.note = `${prov.note ?? ""} — ${QUARANTINE_MARK}: sem fontes primárias; ` +
      "rascunho de referência NÃO validado, NÃO “estado da arte”; aguarda " +
      "investigação com fontes reais e admissão do Piloto.";
    changed = true;
    quarantined += 1;
  }

  if (typeof prov.source_project === "string" && SCRIPTED_PROJECTS.has(prov.source_project) &&
      !String(prov.note ?? "").includes(SCRIPTED_MARK)) {
    prov.scripted = true;
    prov.note = `${prov.note ?? ""} — ${SCRIPTED_MARK}: nasceu numa execução de ` +
      "verificação scripted, não num projeto real do Piloto; não é aprendizagem de projeto.";
    changed = true;
    classified += 1;
  }

  if (changed) {
    rec.provenance = prov;
    writeFileSync(path, YAML.stringify(rec), "utf8");
    console.log(`  marked  ${name}`);
  } else {
    untouched += 1;
  }
}

console.log(
  `\nquarantine-unsourced: ${quarantined} unsourced candidate(s) quarantined, ` +
  `${classified} scripted-origin candidate(s) classified, ${untouched} untouched.`,
);
