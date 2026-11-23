# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ReferFlow is a referral and interview collaboration hub. **Candidates** submit structured referral
requests (company, role, JD, resume link) and track them; **Referrers** set companies + a monthly
quota, work a review queue, move requests through the pipeline and leave feedback.

Imported context (read these before planning a feature):

- Product scope and user stories: @docs/PRD.md
- Architecture decisions and domain model: @docs/architecture.md
- Next.js agent rules written by `next dev`: @AGENTS.md
- Course grading checklist (only when the task is about HW/P3 deliverables): `docs/REQUIREMENTS.md`

## Tech stack

| Layer      | Choice                                                           |
| ---------- | ---------------------------------------------------------------- |
| Framework  | Next.js 16 App Router, React 19, TypeScript (strict)             |
| Styling    | Tailwind CSS 4 (via `@tailwindcss/turbopack` loader)             |
| Data       | PostgreSQL 17 + Prisma 7 (`prisma-client` generator)             |
| Auth       | Auth.js (NextAuth v5) with database sessions                     |
| Validation | Zod 4 at every trust boundary (forms, route handlers, AI output) |
| AI         | Claude Agent SDK — JD/resume matching, referral blurb, prep list |
| Tests      | Vitest (unit + integration), Playwright (E2E), v8 coverage ≥ 70% |
| Deploy/CI  | Vercel (preview + prod) and GitHub Actions                       |

## Commands

```bash
npm run dev              # dev server on http://localhost:3000
npm run build            # production build
npm run lint             # ESLint flat config (+ eslint-config-prettier)
npm run format:check     # Prettier check; `npm run format` writes
npm run typecheck        # next typegen && tsc --noEmit
npm test                 # Vitest, single run
npx vitest run src/lib/referrals/status-machine.test.ts   # one file
npx vitest run -t "rejects a skipped stage"               # by test name
npm run test:coverage    # fails below 70% on src/lib/**
docker compose up -d     # local Postgres (creds in .env.example)
npm run db:migrate       # prisma migrate dev + generate (needs DATABASE_URL)
npm run db:generate      # regenerate Prisma Client
```

Before saying a task is done run: `npm run lint && npm run typecheck && npm test`.

## Architecture decisions (summary — details in docs/architecture.md)

1. **Domain logic is pure and lives in `src/lib/<domain>/`.** Status transitions, quota checks and
   access rules are plain functions with no Prisma/Next imports, so they are unit-tested with TDD.
   Server Actions / route handlers are thin: authenticate → validate (Zod) → call domain function →
   persist with Prisma.
2. **Authorization is decided in one place**: `src/lib/auth/` policy functions take the session
   user and the resource and return allow/deny. Pages, actions and handlers call them; never
   re-implement role checks inline.
3. **Every status change is recorded** in `StatusChange` (from, to, actor, timestamp) in the same
   transaction that updates `ReferralRequest.status`.
4. **Two kinds of referrer notes are separate tables**: `PrivateNote` (author-only, never sent to a
   candidate) and `InterviewFeedback` (visible to the candidate). Never merge them behind a flag.
5. **Prisma Client is imported from `@/generated/prisma`** (git-ignored, generated on install), via
   a single shared client in `src/lib/db.ts`. The datasource URL is in `prisma.config.ts`, not the
   schema (Prisma 7). Prisma 7 needs the `@prisma/adapter-pg` driver adapter, and
   `migrate dev` no longer runs `generate` — run `npm run db:generate` after schema changes or the
   client silently lacks the new models.
6. **Next.js 16 specifics**: request interception is `src/proxy.ts` (not `middleware.ts`);
   `cacheComponents` is on, so data that depends on the session must be read inside a Suspense
   boundary or a dynamic component. Check `node_modules/next/dist/docs/` before using an API you
   remember from Next 13–15.

## Coding conventions

- TypeScript strict; no `any` (use `unknown` + Zod). Export types from the module that owns them.
- File names `kebab-case.ts`; React components `PascalCase` exports in `kebab-case.tsx` files.
- Server Components by default; add `"use client"` only for interactivity, at the leaf.
- Domain functions return a discriminated union (`{ ok: true, value } | { ok: false, error }`)
  for expected failures; throw only for programmer errors.
- Enum-like values come from the Prisma schema (`RequestStatus`, `Role`); do not redeclare string
  literals.
- Prettier owns formatting (100 cols, double quotes, trailing commas). Don't hand-format.

## Testing strategy

- **Strict TDD** for domain logic: write the failing test first, commit it, then implement.
  Commit messages carry the phase:
  - `test(<scope>): red — <behaviour>` (failing tests only, no implementation)
  - `feat(<scope>): green — <behaviour>` (minimum code to pass)
  - `refactor(<scope>): <what>` (no behaviour change, tests still green)
- One `describe` per acceptance criterion, named after it (e.g. `AC2: rejects skipped stages`).
- Unit tests sit next to the code (`foo.ts` + `foo.test.ts`). DB-backed integration tests go in
  `tests/integration/`, Playwright specs in `tests/e2e/`.
- Coverage gate: 70% statements/branches/functions/lines on `src/lib/**`.
- Do not weaken or delete a failing test to get green; fix the code or ask.

## Git workflow

- Branch per GitHub issue: `feature/<issue#>-<slug>`, `fix/<issue#>-<slug>`.
- Conventional Commits; reference the issue (`(#12)`) in the subject or body.
- PRs include the AI-disclosure block from `.github/pull_request_template.md`.
- Never commit `.env*` (except `.env.example`), generated Prisma client, or coverage output.

## Do's and don'ts

- **Do** enforce role + ownership on the server for every read and write (a candidate sees only
  their own requests; a referrer sees only requests addressed to them).
- **Do** validate URLs (resume/JD links) with Zod and render user text as text, never as HTML.
- **Do** keep AI calls server-side; treat model output as untrusted input and validate it.
- **Don't** expose `PrivateNote` in any candidate-facing query, serializer or API response.
- **Don't** let a referrer exceed their monthly quota or receive a duplicate active request from
  the same candidate for the same company + role.
- **Don't** edit `src/generated/**`, `package-lock.json` by hand, or applied migrations in
  `prisma/migrations/` — create a new migration instead.
- **Don't** run `prisma migrate reset`, `git push --force`, or anything touching production data
  without asking.

## Security (OWASP Top 10 awareness)

- A01 Broken Access Control → central policy functions in `src/lib/auth/`, tested per role.
- A02 Cryptographic Failures → Auth.js handles sessions; secrets only in env vars.
- A03 Injection → Prisma parameterized queries only; no `$queryRawUnsafe`.
- A04 Insecure Design → quota/duplicate guards and status machine enforced server-side.
- A05 Security Misconfiguration → no secrets in client bundles (`NEXT_PUBLIC_` only for public).
- A07 Identification & Auth Failures → rate-limit sign-in; never log credentials or tokens.
- A08 Software & Data Integrity → `npm audit` + Gitleaks in CI; lockfile committed.
- A09 Logging & Monitoring → status changes are audited in `StatusChange`.
- A10 SSRF → never fetch user-supplied URLs server-side without an allowlist.

## Context management

How we keep sessions focused is documented in `docs/claude-workflow/context-management.md`.
In short: `/clear` between unrelated tasks, `/compact` with a focus hint at phase boundaries,
`claude --continue` / `--resume` to pick a task back up, and subagents for wide exploration.

## Compact instructions

When compacting, keep: the current issue number and acceptance criteria, the TDD phase
(red/green/refactor) we are in, files changed so far, and any failing test output. Drop file
dumps and exploration that did not lead anywhere.
