// Build identity and PRODUCT-AWARE staleness (ADR-0022, PHASE 1.1).
// The repository moving does not mean the product moved: only commits that
// touch product runtime sources (or uncommitted edits to them) may say
// anything about the running process. A docs-only commit must NEVER mark
// the product stale — the App claiming "newer code exists" when only
// documentation moved is a false statement to the Pilot.

import { execSync } from "node:child_process";

/** The paths whose history defines "the product changed". */
export const PRODUCT_RUNTIME_PATHS = [
  "product/src",
  "product/package.json",
  "product/package-lock.json",
  "product/tsconfig.json",
];

export function gitShortHead(cwd: string): string | null {
  try {
    return execSync("git rev-parse --short HEAD", { cwd, stdio: ["ignore", "pipe", "ignore"] })
      .toString("utf8")
      .trim() || null;
  } catch {
    return null;
  }
}

/**
 * The last commit at-or-before `ref` that touched product runtime sources.
 * This — not HEAD — is the identity that decides staleness.
 */
export function gitProductHead(cwd: string, ref: string): string | null {
  try {
    const out = execSync(
      `git log -1 --format=%h ${ref} -- ${PRODUCT_RUNTIME_PATHS.join(" ")}`,
      { cwd, stdio: ["ignore", "pipe", "ignore"] },
    ).toString("utf8").trim();
    return out || null;
  } catch {
    return null;
  }
}

/** Uncommitted (modified or untracked) files under product runtime sources. */
export function gitDirtyProductFiles(cwd: string): string[] {
  try {
    return execSync(
      `git status --porcelain -- ${PRODUCT_RUNTIME_PATHS.join(" ")}`,
      { cwd, stdio: ["ignore", "pipe", "ignore"] },
    )
      .toString("utf8")
      .split(/\r?\n/)
      .filter((l) => l.trim() !== "")
      .map((l) => l.slice(3).trim());
  } catch {
    return [];
  }
}

export interface StalenessInput {
  /** repo HEAD when this process booted ("unknown" if git unavailable). */
  buildSha: string;
  /** product head at boot (last product-touching commit at-or-before buildSha). */
  buildProductSha: string | null;
  /** current repo HEAD. */
  repoHead: string | null;
  /** current product head (last product-touching commit at-or-before HEAD). */
  productHead: string | null;
  /** count of dirty (uncommitted) product runtime files right now. */
  dirtyProductFiles: number;
}

export interface Staleness {
  /** True only when COMMITTED product runtime sources moved past this build. */
  stale: boolean;
  /** The repo advanced but the product did not (docs-only movement). */
  repoMovedDocsOnly: boolean;
  /** Uncommitted product edits exist — disclosed, never claimed as "newer code in the repo". */
  dirtyProduct: boolean;
}

/**
 * Pure decision — unit-tested in the smoke (acceptance gates 1 and 2 of the
 * CEO programme): a docs-only commit does not mark the product stale; a
 * product-source commit does.
 */
export function computeStaleness(i: StalenessInput): Staleness {
  const productMoved =
    i.buildProductSha !== null && i.productHead !== null && i.productHead !== i.buildProductSha;
  const repoMoved = i.repoHead !== null && i.buildSha !== "unknown" && i.repoHead !== i.buildSha;
  return {
    stale: productMoved,
    repoMovedDocsOnly: repoMoved && !productMoved,
    dirtyProduct: i.dirtyProductFiles > 0,
  };
}
