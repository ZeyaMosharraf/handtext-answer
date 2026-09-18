# HandText — Planning Directory

This directory holds all GSD (Get Stuff Done) planning artifacts for the HandText project.

## Structure

```
.planning/
├── README.md                          ← This file
├── PROJECT.md                         ← Project-level context (goals, stack, constraints)
├── ROADMAP.md                         ← Phase roadmap across all milestones
├── phases/
│   └── graph-support/
│       ├── CONTEXT.md                 ← Phase decisions from gsd-discuss-phase
│       ├── RESEARCH.md                ← Deep technical research
│       ├── ARCHITECTURE.md            ← Graph subsystem architecture
│       ├── PLAN.md                    ← Implementation plan (produced by gsd-plan-phase)
│       └── UAT.md                     ← User acceptance test criteria
```

## Conventions

| Artifact | Purpose |
|---|---|
| `CONTEXT.md` | Decisions locked before planning. Guides research/plan agents. |
| `RESEARCH.md` | Full technical investigation answers before any code is written. |
| `ARCHITECTURE.md` | Subsystem-level design: files, interfaces, data flow, boundaries. |
| `PLAN.md` | Concrete phased implementation plan with tasks, risks, verification. |
| `UAT.md` | Acceptance test cases for browser-level functional verification. |

## Documentation Conventions used in `docs/`

All canonical user-facing and architecture documentation lives in `docs/`.
Planning artifacts (this directory) are working / in-progress design documents.
Once a phase ships, its decisions are summarized in `docs/` and the relevant `docs/decisions/` ADR.
