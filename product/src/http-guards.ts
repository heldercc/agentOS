// Pure, dependency-free HTTP security decisions for the :4900 shell
// (ADR-0023 local security slice, CEO acceptance gate 9). No imports —
// shell.ts binds to the port at import time, so it can't be imported by the
// smoke test directly; these decisions are pulled out here so they ARE
// importable and testable without ever starting a server.

/**
 * The Host header on a mutating request must name loopback, with or
 * without the shell's own port. Anything else is a request that arrived
 * through some other hostname/proxy — reject it (403).
 */
export function hostAllowed(host: string | undefined, port: number): boolean {
  if (!host) return false;
  const h = host.trim().toLowerCase();
  return (
    h === "127.0.0.1" ||
    h === `127.0.0.1:${port}` ||
    h === "localhost" ||
    h === `localhost:${port}`
  );
}

/**
 * The CSRF/cross-origin gate: if a browser sent an Origin header, it must
 * point at this same loopback origin. An ABSENT Origin is allowed (plain
 * curl/CLI callers, and same-origin requests some browsers omit it for) —
 * only a PRESENT, mismatched Origin is the cross-origin attack this blocks.
 */
export function originAllowed(origin: string | undefined, port: number): boolean {
  if (origin === undefined || origin === "") return true;
  const o = origin.trim().toLowerCase().replace(/\/$/, "");
  const suffix = port === 80 ? "" : `:${port}`;
  return o === `http://127.0.0.1${suffix}` || o === `http://localhost${suffix}`;
}

/** 1 MB — generous for this shell's JSON bodies (free text, no uploads). */
export const DEFAULT_BODY_LIMIT_BYTES = 1024 * 1024;

/** True once the accumulated body would exceed the limit — abort with 413. */
export function bodyTooLarge(bytesSoFar: number, limit = DEFAULT_BODY_LIMIT_BYTES): boolean {
  return bytesSoFar > limit;
}
