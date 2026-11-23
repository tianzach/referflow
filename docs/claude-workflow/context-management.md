# Context Management Strategy

How the ReferFlow pair keeps Claude Code sessions focused and cheap. These are the rules we follow;
the annotated session logs in `docs/session-logs/` show them in practice.

## 1. Durable context goes in files, not in chat

| What                                | Where                                  | Loaded                        |
| ----------------------------------- | -------------------------------------- | ----------------------------- |
| Stack, conventions, do's/don'ts     | `CLAUDE.md`                            | every session, automatically  |
| Product scope                       | `docs/PRD.md` (via `@import`)          | every session                 |
| Domain model, status machine, quota | `docs/architecture.md` (via `@import`) | every session                 |
| Feature plan for the current issue  | `docs/plans/<issue>-<slug>.md`         | on demand (`@docs/plans/...`) |
| Acceptance criteria                 | GitHub issue body                      | `gh issue view <n>`           |
| Personal facts (preferences, setup) | auto-memory (`/memory`)                | every session, per developer  |

If we explain the same thing to Claude twice, it belongs in one of these files.

## 2. One task per session — `/clear` between tasks

- Start each issue in a fresh session (or `/clear`) so exploration from the previous feature does
  not leak into the next one.
- First prompt of a session names the issue and phase: _"Issue #2, Explore phase. Read
  `docs/architecture.md` and the files under `src/lib/referrals/`; don't edit anything."_

## 3. `/compact` at phase boundaries, with a focus hint

The Explore phase produces lots of file reads that are not needed once the plan exists. After the
plan is written to `docs/plans/…`, run:

```
/compact keep the plan in docs/plans/002-status-machine.md, the acceptance criteria, and the TDD phase; drop file dumps
```

`CLAUDE.md` also has a **Compact instructions** section so auto-compaction keeps the same things.

## 4. Resume instead of re-explaining — `--continue` / `--resume`

- `claude --continue` reopens the most recent session in this directory (e.g. after a break between
  the red and green commits).
- `claude --resume` picks an older session from a list (e.g. going back to the issue #1 session to
  answer a review comment).
- Because plans and ACs live in files, a resumed or brand-new session can recover with one prompt:
  _"Read docs/plans/002-status-machine.md and `git log --oneline -5`; continue from the last
  commit."_

## 5. Subagents for wide reads

Broad "where is X used?" questions go to the Explore subagent so only its summary lands in the main
context. The main session keeps the plan, the tests and the diff.

## 6. Plan mode before edits

`Shift+Tab` into Plan mode for the Plan phase: Claude can read but not edit, and the approved plan
is saved to `docs/plans/`. This stops half-planned edits from filling the context with diffs we
later revert.

## 7. Watch the budget

`/context` shows what is using the window. If MCP tool definitions or old tool output dominate,
`/clear` and restart from the plan file rather than pushing through a bloated session.
