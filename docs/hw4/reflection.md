# HW4 Reflection: Claude Code Workflow & TDD

_ReferFlow pair: Zichen Tian and partner. Features: #1 data model (Explore → Plan → Implement →
Commit), #2 status machine (TDD), #3 quota guard (TDD, partner)._

## 1. How does Explore → Plan → Implement → Commit compare to our previous approach?

In earlier projects our loop with an AI assistant was mostly "describe the feature, get code, fix
whatever breaks". That works for small UI changes. It goes wrong when the assistant's training data
is older than the libraries it's using, and this repo runs Next.js 16, Prisma 7, Zod 4 and Vitest 5,
all newer than most examples online.

The **Explore** phase is where that paid off most. Before writing the schema, the Explore subagent
read the generated Prisma client and found that Prisma 7 _requires_ a driver adapter
(`@prisma/adapter-pg`) and that the client import path is `@/generated/prisma/client`. If we had
started from memory, the first version of `src/lib/db.ts` would have used the Prisma 5 pattern and
failed at runtime. Because the subagent did the wide reading, only a ~400-word report entered the main
context instead of dozens of file dumps.

The **Plan** phase forced us to decide the shape of the model before touching code. We chose to keep
`PrivateNote` and `InterviewFeedback` as separate tables instead of one table with a visibility flag,
because a flag is one missed `where` clause away from leaking a referrer's private notes to a
candidate. Writing the plan as a file (`docs/plans/001-data-model.md`) with a commit-by-commit
breakdown also made the **Commit** phase almost mechanical: each planned step became one reviewable
commit.

The workflow also made deviations visible. Two things happened that the plan didn't predict:

- Prisma 7's `migrate dev` no longer runs `generate`, so `db.user` was `undefined` in the smoke test.
- The first "red" test run failed for the **wrong reason**. Vitest couldn't start because npm had
  dropped rolldown's native binding from the lockfile. A red bar that comes from a broken toolchain
  proves nothing about the code. We only noticed because we checked _why_ the test failed.

Both went into an "Outcome" section of the plan and into `CLAUDE.md`, so the next session (or the
partner's session) doesn't rediscover them. The old "just generate code" approach has no step that
captures this kind of lesson.

**Cost.** For a tiny change (e.g. the ESLint `_` rule) the four phases are overhead. We'd use the
full loop for anything that touches the schema, auth or more than one layer, and skip straight to
implement for one-file fixes.

**TDD with Claude Code.** Strict red → green made the AI's output easier to trust, not harder.
Claude wrote the minimum code per cycle, and the tests for later acceptance criteria then _drove_ a
better design. After cycle 2 the rules were split between a transition table and ad-hoc `if`s for
withdraw/close. The refactor step merged them into one `RULES[from][to] = parties` table. That made
cycle 4 (`allowedTransitions`, which drives UI buttons) a three-line function. An exhaustive test now
checks that `allowedTransitions` and `transition()` agree for every status × actor × target. One
risk is that an AI can "pass" a test by special-casing it. Committing the red tests separately and
reviewing the green diff against them is what guards against that.

## 2. What context management strategies worked best?

1. **Put durable facts in files, not in the chat.** `CLAUDE.md` `@import`s the PRD and
   `docs/architecture.md`, so every session starts with the domain model and the status lifecycle
   already loaded. When we hit a gotcha (Prisma `generate`, the npm lockfile bug), we added it to
   `CLAUDE.md` right away.
2. **Use subagents for wide reads.** The Explore subagent read `node_modules` type definitions and the
   Next.js docs, and the main session got back only the facts it needed.
3. **Keep plan files as checkpoints.** Because the plan, the acceptance criteria (GitHub issues) and
   the commit history are all on disk, a new session can recover after `/clear` or
   `claude --continue` with one prompt: "read the plan and `git log --oneline -5`, continue".
4. **Add compact instructions to `CLAUDE.md`.** These tell `/compact` (manual or automatic) to keep
   the issue number, ACs, TDD phase and failing output, and to drop exploration dumps.
5. **One issue per session.** Starting each issue with `/clear` keeps unrelated exploration from
   leaking into the next feature.

What didn't work as well: long shell output (full `npm install` logs, Vitest stack traces) fills the
context quickly. We now pipe commands through `grep`/`tail` to keep only the lines that matter.

## Partner's perspective

_(Partner: add 1–2 paragraphs about your session on #3, including how Plan mode compared with
writing the plan by hand, and when `/compact` or `--continue` helped or hurt.)_
