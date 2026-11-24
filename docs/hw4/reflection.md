# HW4 Reflection: Claude Code Workflow & TDD

_ReferFlow pair: Zichen Tian and Zheqi Lv. Features: #1 data model (Explore → Plan → Implement →
Commit), #2 status machine (TDD), #3 quota guard (TDD, partner)._

## 1. How does Explore → Plan → Implement → Commit compare to our previous approach?

In earlier projects our loop with an AI assistant was mostly "describe the feature, get code, fix
whatever breaks". There was no written plan, and tests came afterwards, if at all. That works for
small UI changes. It goes wrong when the assistant's training data
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

**Review in a separate session.** PR #5 was written in Zichen's session and reviewed in Zheqi's,
with Claude acting as the reviewer agent (writer/reviewer pattern). Because the reviewer started from
a clean context, it was not anchored on the writer's reasoning. It re-ran the test file at every
commit to check that each red failed on an assertion and each refactor kept the count unchanged. It
also found two issues the writer had missed: on Node 20, Vitest's failure reporter crashes, so a red
run looks like a tooling error; and the domain function returns `TERMINAL_STATUS` before
`FORBIDDEN`, so the Server Action must run the ownership check first or it leaks another candidate's
request status. Both became notes for later issues instead of being lost in a chat. For PR #6 we
swapped roles. The reviewer re-ran two red commits, and their failure counts matched the PR. It also
flagged that the quota check is read-then-write, so the Server Action needs a serializable
transaction.

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
   the issue number, ACs, TDD phase and failing output, and to drop exploration dumps. In Zheqi's
   #3 session, compacting at the Plan → Implement boundary kept the ACs and the cycle table word
   for word. Exact file text didn't survive, so Claude re-read files before editing them.
5. **One issue per session.** Starting each issue with `/clear` keeps unrelated exploration from
   leaking into the next feature.

What didn't work as well: long shell output (full `npm install` logs, Vitest stack traces) fills the
context quickly. We now pipe commands through `grep`/`tail` to keep only the lines that matter.

## Partner's perspective

_Lildonk: issue #3 (quota guard, PR #6) and the PR #5 review. Session log:
[`2026-11-24-partner-pr5-review-issue3-plan-mode-tdd.md`](../session-logs/2026-11-24-partner-pr5-review-issue3-plan-mode-tdd.md)._

**Plan mode vs. a hand-written plan.** Zichen wrote the #1 plan as a file. I used interactive Plan
mode for #3, and the main difference is that Plan mode is a hard gate. Claude can only read until I
approve, so my feedback lands in the plan before any code exists. I used that twice. First: "don't
overkill, and don't overlap with what Zichen did or planned". Second: "shared files are fine, just
don't overlap". Each time the scope changed in the plan, not through a later revert. A Plan subagent
running in parallel produced a second design that wasn't anchored on the first. The most useful test
in the PR came from comparing the two: it runs the UTC-boundary cases in a UTC+14 zone, because CI
runs in UTC, where `getMonth()` and `getUTCMonth()` agree. There were rough edges. Approving with
comments arrives as a "rejection". The approved plan lives in `~/.claude/plans/`, so we still had to
copy it into `docs/plans/003-quota-guard.md` to make it reviewable. A hand-written plan file skips
that step, but it also skips the gate. The plan's "expected red" column was worth having on its own:
when C4's red failed only 7 tests, that matched the prediction instead of being a surprise.

**`/compact` and `--continue`.** I compacted at the Plan → Implement boundary with an explicit
keep/drop instruction, and that worked well. The summary kept the ACs, the design decisions, the
cycle table and even my scope feedback word for word, and the next call went straight to the first
red test. What a summary can't keep is exact text: Claude re-read every file before editing it after
the compaction. So the committed plan, not the summary, was the real safety net. `claude --continue`
from a terminal resumed the same session ID with the compaction marker, so nothing had to be
re-explained. Two things surprised me. The resumed view shows only the condensed history up to the
compaction, which at first looked like something was missing. And it is a second window onto the
same transcript, so only one window should be used at a time; I kept working in the editor chat.
