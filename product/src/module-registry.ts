// Architecture Module Registry (ADR-0023 RULES B/C). This is the mechanical
// inventory: every durable module names its plane, contract, authority,
// state, I/O, evidence, schema, observability, tests and doctrine.

export const MODULE_REGISTRY_VERSION = 1;

export type ModulePlane = "governance" | "intelligence" | "state" | "product-surface";

export interface ModuleRegistration {
  id: string;
  path: string;
  plane: ModulePlane;
  contractVersion: string;
  authorityBoundary: string;
  ownedState: string[];
  inputs: string[];
  outputs: string[];
  events: string[];
  schemas: string[];
  observability: string[];
  tests: string[];
  doctrine: string[];
}

function module(
  id: string,
  path: string,
  plane: ModulePlane,
  boundary: string,
  details: Partial<Omit<ModuleRegistration, "id" | "path" | "plane" | "contractVersion" | "authorityBoundary">> = {},
): ModuleRegistration {
  return {
    id,
    path,
    plane,
    contractVersion: "1.0.0",
    authorityBoundary: boundary,
    ownedState: details.ownedState ?? [],
    inputs: details.inputs ?? [],
    outputs: details.outputs ?? [],
    events: details.events ?? [],
    schemas: details.schemas ?? [],
    observability: details.observability ?? [],
    tests: details.tests ?? ["src/cli/smoke.ts"],
    doctrine: details.doctrine ?? ["ADR-0020", "ADR-0023"],
  };
}

export const MODULES: readonly ModuleRegistration[] = [
  module("build-identity", "src/build.ts", "product-surface", "Reads Git identity; never mutates product or repository state."),
  module("effort-probe", "src/effort.ts", "governance", "Measures and discloses effort; hard enforcement remains deferred by ADR-0022."),
  module("evidence", "src/evidence.ts", "governance", "Only Kernel-facing functions append governed evidence.", { ownedState: ["evidence.jsonl"], events: ["EvidenceEvent"], schemas: ["EvidenceEvent@1"] }),
  module("human-intelligence", "src/hi.ts", "state", "Pilot governs admission; seed.sensei is canonical ownership.", { ownedState: ["human-intelligence/**"], schemas: ["GuruSeed@1", "Sensei@1"] }),
  module("http-guards", "src/http-guards.ts", "product-surface", "Pure loopback/Origin/body decisions; grants no authority."),
  module("kernel", "src/kernel.ts", "governance", "Sole runtime authorizer, context scheduler and governed state transition boundary.", { ownedState: ["workspace/**"], inputs: ["Pilot acts", "Work Orders"], outputs: ["Decision Surfaces", "Artifacts", "Project State"], events: ["EvidenceEvent"], schemas: ["Project@1", "WorkOrderRecord@1", "DecisionSurface@1"] }),
  module("manifest", "src/manifest.ts", "governance", "Enumerates context by reference; cannot execute work.", { schemas: ["ContextManifest@1"] }),
  module("migrations", "src/migrations.ts", "state", "Moves schema only through registered, checkpointed migrations; failure forces safe mode.", { ownedState: ["_meta/schema.json", "_meta/migrations.jsonl"] }),
  module("module-registry", "src/module-registry.ts", "governance", "Declares modules and contracts; does not authorize execution."),
  module("paths", "src/paths.ts", "state", "Resolves contained local roots; accepts no escaping project identifier."),
  module("poll-logic", "src/poll-logic.ts", "product-surface", "Classifies transport state; never changes canonical state."),
  module("project-engine", "src/project-engine.ts", "governance", "Pure Project Map mechanics inside the Kernel; owns no executor, authority, audit log or context assembly.", { schemas: ["ProjectMap@1", "ProjectSlice@1"], doctrine: ["ADR-0022", "ADR-0024"] }),
  module("seed-resolver", "src/resolver.ts", "governance", "Selects attributable expertise; never admits or mutates it.", { inputs: ["Work Order tags", "Project State", "GuruSeeds"], outputs: ["Resolved seed references"] }),
  module("runtime", "src/runtime.ts", "intelligence", "Executes only a Kernel-issued GenerateArgs and returns normalized results.", { outputs: ["ModelResult", "heartbeat"], schemas: ["ModelResult@1"] }),
  module("stores", "src/stores.ts", "state", "Atomic canonical I/O and containment primitives; no domain policy."),
  module("transitions", "src/transitions.ts", "state", "Coordinates explicit multi-file before-images; cannot choose business transitions.", { ownedState: ["_meta/transitions/**"] }),
  module("types", "src/types.ts", "state", "Declares persistent contracts; contains no runtime authority."),
  module("validation", "src/validate.ts", "state", "Rejects malformed canonical records; never repairs silently."),
  module("shell", "src/cli/shell.ts", "product-surface", "Presents Kernel governance; cannot bypass Kernel authority.", { inputs: ["loopback HTTP"], outputs: ["PT-PT Executive Mode"] }),
  module("metrics-cli", "src/cli/metrics.ts", "product-surface", "Read-only evidence extractor; never changes canonical state."),
  module("guild-preload-cli", "src/cli/preload-guild.ts", "state", "Creates candidates only; never admits expertise."),
  module("guild-quarantine-cli", "src/cli/quarantine-unsourced.ts", "state", "Labels epistemic status; never admits or deletes expertise."),
  module("smoke", "src/cli/smoke.ts", "product-surface", "Runs only against isolated roots with FakeRuntime; never touches Pilot state.", { tests: ["src/cli/smoke.ts"] }),
];

export function assertModuleRegistry(paths: readonly string[]): void {
  const registered = new Set(MODULES.map((item) => item.path.replace(/\\/g, "/")));
  const missing = paths.map((path) => path.replace(/\\/g, "/")).filter((path) => !registered.has(path));
  const duplicates = MODULES.filter((item, index) => MODULES.findIndex((other) => other.id === item.id) !== index).map((item) => item.id);
  if (missing.length > 0 || duplicates.length > 0) {
    throw new Error(`module registry invalid; missing=${missing.join(",") || "none"}; duplicateIds=${duplicates.join(",") || "none"}`);
  }
}
