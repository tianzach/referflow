# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ReferFlow is a referral and interview collaboration hub with two roles, **Candidate** and **Referrer**. Product scope is in `docs/PRD.md`; course grading requirements are in `docs/REQUIREMENTS.md`. The repo is currently a fresh scaffold, so most product code is still to be written.

## Commands

```bash
npm run dev              # Next.js dev server on http://localhost:3000
npm run build            # production build
npm run lint             # ESLint (flat config, eslint.config.mjs)
npm run format:check     # Prettier check (npm run format to write)
npm run typecheck        # next typegen && tsc --noEmit
npm test                 # Vitest, single run
npx vitest run path/to/file.test.ts      # one test file
npx vitest run -t "name of the test"     # tests matching a name
npm run test:coverage    # coverage, 70% threshold on src/lib/**
docker compose up -d     # local Postgres 17 (credentials in .env.example)
npm run db:migrate       # prisma migrate dev
npm run db:generate      # regenerate Prisma Client
```

## Architecture notes

- **Next.js 16 App Router** under `src/app`, React 19, Tailwind CSS 4 (loaded via the `@tailwindcss/turbopack` loader in `next.config.ts`). `cacheComponents` and `partialPrefetching` are enabled in `next.config.ts`.
- Route-aware global types such as `LayoutProps<"/">` come from `next typegen`; that is why `typecheck` runs typegen before `tsc`.
- **Prisma 7**: the schema is `prisma/schema.prisma`, but the datasource URL lives in `prisma.config.ts` (loaded from `.env` via `dotenv`). The client is generated to `src/generated/prisma` (git-ignored, regenerated on `postinstall`); import it from there, not from `@prisma/client`.
- Path alias `@/*` → `src/*` (tsconfig and Vitest).

## Next.js version warning (from AGENTS.md)

This Next.js version has breaking changes compared to older training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code and heed deprecation notices. `next dev` rewrites the rules block in `AGENTS.md`; commit it rather than deleting it.
