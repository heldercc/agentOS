# ADR-0006: The Effort Probe Supersedes the Cost Probe

- **Status:** Accepted
- **Date:** 2026-07 (Session 003)
- **Deciders:** Pilot

## Context

The Cost Probe measured what work did cost — an accountant. Governance, however,
happens *before* execution: the Pilot consents to work based on what it will
demand and what it will likely return. Measurement alone arrives too late to
govern.

## Decision

Replace the Cost Probe with the **Effort Probe**: a Kernel instrument that
estimates, before execution, the effort a work order will demand (tokens, time,
refinement rounds) and the return it is likely to produce (quality gain), and
issues a recommendation (proceed / reduce scope / abstain). After execution it
measures actuals; every estimate/actual gap calibrates the estimator.

Honesty bounds precision: speculative quantities (quality gain, ROI) are
reported as ranges with confidence until calibration data exists. The probe
never manufactures certainty (Article 2).

## Alternatives Considered

- **Keep measurement-only Cost Probe** — rejected: cannot inform consent.
- **Full ROI model from day one** — rejected: uncalibrated ROI numbers are
  decoration wearing the costume of rigor.

## Consequences

- The Kernel gains an estimation duty and a calibration loop.
- Executive Mode gains its "effort" column with honest error bars.
- Estimation model and calibration mechanics owe a design ADR before Phase 1
  completes.
