// The testable twin of the inline client poll logic embedded in shell.ts's
// PAGE template string (search that file for "shouldApplyPollClient" /
// "classifyPollOutcomeClient"). Browser inline JS cannot import a module, so
// the two copies are hand-mirrored: any change here must be mirrored there,
// and vice versa (ADR-0022 PHASE 1 item 6 — poll hardening). No imports —
// this file must stay a trivially portable pair of pure functions.

/**
 * A response is applied only if it is strictly newer than the last applied
 * one. Out-of-order network delivery (an older response arriving after a
 * newer one already landed) must never overwrite fresher state; a duplicate
 * (equal sequence number) is likewise rejected.
 */
export function shouldApplyPoll(lastAppliedSeq: number, responseSeq: number): boolean {
  return responseSeq > lastAppliedSeq;
}

/**
 * Classifies one poll attempt into the three outcomes the Pilot-facing
 * banner distinguishes. A genuine connection failure (the fetch itself
 * rejected — network down, or the 5s abort fired) is a DIFFERENT signal
 * from a connection that succeeded but returned bad data (a non-200 status,
 * or a body that failed to parse as JSON) — the Pilot deserves an honest
 * distinction between "the App is unreachable" and "the App answered but
 * something is wrong server-side".
 */
export function classifyPollOutcome(o: {
  fetchRejected: boolean;
  httpStatus: number | null;
  parseFailed: boolean;
}): "ok" | "data-error" | "connection-failure" {
  if (o.fetchRejected) return "connection-failure";
  if (o.httpStatus !== 200 || o.parseFailed) return "data-error";
  return "ok";
}
