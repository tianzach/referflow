# Plan 003 — Referrer quota and duplicate-request guard (issue #3)

Workflow: Explore → **Plan** (Claude Code Plan mode) → Implement (strict TDD) → Commit. HW4 Parts 2–3,
partner side. This file is the plan approved in Plan mode, copied into the repo.

## Explore findings

- `isTerminal(status)` is exported from `src/lib/referrals/status-machine.ts` (#2). Terminal
  statuses come from its `RULES` table, so the quota code must reuse it and not re-list
  DECLINED/OFFER/CLOSED.
- Schema: `ReferrerProfile { userId, companies String[], monthlyQuota, acceptingRequests }`,
  `ReferralRequest { candidateId, referrerId, company, roleTitle, status }`,
  `StatusChange { to, createdAt }`.
- `ReferrerProfileModel`, `ReferralRequestModel` and `StatusChangeModel` are **type-only** exports
  from `@/generated/prisma/models`. Inputs typed as `Pick<>`s of them stay in sync with the schema,
  and a Server Action can pass a `findMany` result (with `include: { statusChanges }`) directly.
- `newReferralRequestSchema` trims `company`/`roleTitle` but keeps their case, so stored rows can
  differ only by case or inner spacing. Comparisons must normalize.
- Toolchain: on Node 20, Vitest's failure reporter crashes (`Map.groupBy is not a function`), so a
  red run looks like a tooling error. Tests run on Node 24 (`.nvmrc`).

## Approach

```ts
quotaUsage(profile, requests, now) → { referredThisMonth, approvedNotYetReferred, remaining }
canApprove(profile, requests, now) → { ok: true; remaining } | { ok: false; error: "QUOTA_EXCEEDED" }
canSubmitRequest(candidateId, referrer, input, existing)
  → { ok: true } | { ok: false; error: "NOT_ACCEPTING" | "COMPANY_NOT_OFFERED" | "DUPLICATE_ACTIVE_REQUEST" }
```

How each ambiguity in the issue is resolved:

- **Counting a referral.** A request counts if it has a `to: REFERRED` StatusChange inside `now`'s
  UTC calendar month. Its current status doesn't matter, so a request referred this month and now
  INTERVIEWING or CLOSED still counts. `createdAt` is ignored.
- **approvedNotYetReferred.** Every request currently in APPROVED counts.
- **remaining.** `max(0, monthlyQuota − referred − approved)`, so it is never negative when a
  referrer lowers their quota. `canApprove` is ok exactly when `remaining > 0`.
- **Normalization.** Trim, collapse whitespace, lowercase. It applies to both the `companies` match
  and the duplicate key.
- **Error precedence.** NOT_ACCEPTING, then COMPANY_NOT_OFFERED, then DUPLICATE_ACTIVE_REQUEST.
- **Other referrers' rows.** Rows for another referrer (or, when checking submissions, another
  candidate) are ignored.

## TDD cycles

| #   | Red (tests only, committed first)                         | Expected red                         | Green                       |
| --- | --------------------------------------------------------- | ------------------------------------ | --------------------------- |
| C1  | AC1 + AC3: REFERRED this UTC month, boundaries, year roll | `./quota` can't be resolved          | `quotaUsage`                |
| C2  | AC2: (referred, approved, quota) table; quota below usage | `canApprove is not a function`       | `canApprove`                |
| R1  | refactor whatever duplication the green step left         | stays green                          |                             |
| C3  | AC5: NOT_ACCEPTING, COMPANY_NOT_OFFERED                   | `canSubmitRequest is not a function` | accepting + company checks  |
| C4  | AC4 + AC6: active blocks, ended doesn't; precedence       | AC4 cases get `{ ok: true }`         | duplicate via `!isTerminal` |
| R2  | refactor: shared `normalize()`                            | stays green                          |                             |

## Commit plan

1. `docs(plan): quota guard plan for #3` (this file)
2. C1–C4 as `test(quota): red — …` then `feat(quota): green — …`, plus `refactor(quota): …`
3. `docs(claude): Node 24 is required for readable red runs`
4. `docs(plan): record implementation outcome for #3`

## Out of scope

Server Actions, UI and DB integration tests, which come in later issues. The A01 note from the
PR #5 review (a user who isn't a party to the request must get a generic error before any status
detail) belongs to the action-layer issue.

## Outcome (after Implement)

All four cycles and both refactors landed as planned (10 commits). Replaying
`quota.test.ts` at each commit on Node 24:

| Commit    | Step  | Result                                                     |
| --------- | ----- | ---------------------------------------------------------- |
| `e16e52e` | C1 🔴 | suite fails: `Cannot find module './quota'`                |
| `338342e` | C1 🟢 | 16 passed                                                  |
| `5e882e0` | C2 🔴 | 11 failed (`canApprove is not a function`), 16 passed      |
| `60c329a` | C2 🟢 | 27 passed                                                  |
| `79769cd` | R1    | 27 passed                                                  |
| `69dc9a1` | C3 🔴 | 9 failed (`canSubmitRequest is not a function`), 27 passed |
| `1c3616b` | C3 🟢 | 36 passed                                                  |
| `f149420` | C4 🔴 | 7 failed (`expected { ok: true }`), 44 passed              |
| `c4f6763` | C4 🟢 | 51 passed                                                  |
| `fcf0313` | R2    | 51 passed                                                  |

Two things the plan didn't predict:

- **The UTC tests needed a non-UTC zone to mean anything.** CI and most laptops run in UTC, where
  `getMonth()` and `getUTCMonth()` agree. The AC3 block therefore stubs `TZ=Pacific/Kiritimati`
  (UTC+14) and first asserts that the stub took effect. Swapping in the local-time getters makes 3
  AC3 cases fail, which confirms the guard works.
- **C4's red was partial by design.** The AC6 cases ("ended requests don't block"), the "does not
  count" cases and the precedence test already passed before the duplicate check existed. They are
  guards that the green step must not break, and the commit body says so.

Full suite at the end: lint, format and typecheck are clean; 121/121 tests pass; `quota.ts` has
100% statements, branches, functions and lines.
