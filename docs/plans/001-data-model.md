# Plan 001 — Domain data model (issue #1)

Workflow: Explore → **Plan** → Implement → Commit (HW4 Part 2).

## Explore findings (Glob / Grep / Read via the Explore subagent)

- `prisma/schema.prisma` has only the generator + datasource, no models, no migrations folder.
- Prisma 7 generates to `src/generated/prisma`; the entry point is `client.ts`
  (`@/generated/prisma/client`). `enums.ts` can be imported on its own without a DB connection.
- Prisma 7 **requires a driver adapter** for PostgreSQL (`internal/prismaNamespace.ts`: "A driver
  adapter is required unless you connect … through Prisma Accelerate"). `@prisma/adapter-pg` and
  `pg` are not installed.
- Next.js 16 auth guide: Proxy (`src/proxy.ts`) only does optimistic cookie checks; real role
  checks belong in a data-access layer called from Server Components / Actions. So role checks will
  not rely on the schema alone; the policy layer will be added in a later issue.
- Zod 4.6: `z.url({ protocol: /^https$/ })` gives https-only URLs (`z.httpUrl()` also allows http).
- `next-auth` / `@auth/prisma-adapter` are not installed yet (the auth issue will add them). We
  still model the Auth.js tables now so the first migration is stable.

## Approach

1. **Dependencies**: `@prisma/adapter-pg` and `pg` (runtime).
2. **Schema** (`prisma/schema.prisma`):
   - enums `Role { CANDIDATE REFERRER }`,
     `RequestStatus { PENDING APPROVED DECLINED REFERRED INTERVIEWING OFFER CLOSED }`.
   - `User` (id cuid, email unique, name, image, emailVerified, passwordHash?, role default
     CANDIDATE, timestamps).
   - Auth.js adapter tables: `Account` (compound unique provider+providerAccountId), `Session`
     (sessionToken unique), `VerificationToken` (identifier+token unique). Field names follow the
     `@auth/prisma-adapter` convention.
   - `ReferrerProfile` (userId unique FK, `companies String[]`, `monthlyQuota Int default 5`,
     `acceptingRequests Boolean default true`, `headline?`).
   - `ReferralRequest` (candidateId FK, referrerId FK, company, roleTitle, jobDescription `Text`,
     jobUrl, resumeUrl, candidateNote?, status default PENDING, declineReason?, timestamps).
     Indexes: `(referrerId, status)` for the queue; `(candidateId, createdAt)` for the dashboard.
   - `StatusChange` (requestId FK cascade, from `RequestStatus?` (null for creation), to, actorId
     FK, reason?, createdAt). Index `(requestId, createdAt)`.
   - `PrivateNote` (requestId, authorId, body Text, timestamps).
   - `InterviewFeedback` (requestId, authorId, round Int, title, body Text, timestamps).
   - Two relations User↔ReferralRequest need relation names (`CandidateRequests`,
     `ReferrerRequests`).
3. **Migration**: `prisma migrate dev --name init` against the local Docker Postgres; commit the SQL.
4. **DB client** `src/lib/db.ts`: one `PrismaClient` with `PrismaPg` adapter, cached on
   `globalThis` outside production so hot reload doesn't open new pools.
5. **Input validation** `src/lib/referrals/request-input.ts` (test-first):
   `newReferralRequestSchema` — trimmed strings; company 1–100, roleTitle 1–120,
   jobDescription 50–20 000 chars, jobUrl + resumeUrl https-only, candidateNote ≤ 1000 optional,
   referrerId non-empty. Export `NewReferralRequestInput` type.
   Tests: valid input passes + trims; http URL rejected; javascript: URL rejected; too-short JD
   rejected; missing company rejected; long note rejected.

## Commit plan

1. `docs(plan): data model plan for #1` (this file)
2. `feat(db): Prisma schema and initial migration for ReferFlow domain (#1)`
3. `feat(db): shared Prisma client with pg driver adapter (#1)`
4. `test(referrals): red — referral request input validation (#1)`
5. `feat(referrals): green — Zod schema for new referral requests (#1)`
6. `docs: update architecture with final schema notes (#1)` (if anything changed)

## Out of scope

Auth.js wiring, policy functions, UI. Status transition rules are issue #2; quota rules issue #3.

## Risks

- Prisma 7 + adapter API differs from Prisma 5/6 examples online → rely on generated docstrings.
- `String[]` for companies is Postgres-only; acceptable (we only target Postgres).

## Outcome (after Implement)

All six commits landed as planned, plus two that the plan didn't predict:

- **Prisma 7 `migrate dev` no longer runs `generate`.** The smoke test showed `db.user` was
  `undefined` until we ran `prisma generate`. `npm run db:migrate` now runs both, and CLAUDE.md
  records the gotcha.
- **Vitest 5 failed to start** (`Cannot find native binding`, npm/cli#4828) because the lockfile
  lacked rolldown's platform bindings. We regenerated the lockfile in its own `chore(deps)` commit.
  This was caught because we checked _why_ the red test failed, not just _that_ it failed.
- We added an ESLint rule for `_`-prefixed unused bindings as a refactor step.
