# CS6983 Project 3 (ReferFlow) & HW4 / HW5 Requirements Checklist

## 📅 Timeline & Weight Overview

| Milestone                     | Due Date                           | Points / Weight | Core Objective                                                                |
| :---------------------------- | :--------------------------------- | :-------------- | :---------------------------------------------------------------------------- |
| **Slack Proposal Approval**   | At least 1 week before P3 deadline | Required        | Get project idea approved by the professor on `#projects` Slack channel       |
| **HW4: Workflow & TDD**       | Nov 25 (Wed) 11:59pm               | 50 pts          | Repo setup, `CLAUDE.md`, 4-phase workflow, strict TDD                         |
| **HW5: Skill + MCP**          | Dec 6 11:59pm                      | 50 pts          | 1 custom Skill (v1 → v2 iteration) + 1 MCP Server integration                 |
| **Project 3: Production App** | Dec 15 11:59pm                     | 200 pts (19%)   | Deployed production app, full Claude Code mastery, 8-stage CI/CD, docs & demo |

---

## 📌 HW4: Claude Code Workflow & TDD (50 pts)

_Completed in pairs directly within the P3 repository._

### Part 1: Claude Code Project Setup (25% / 12.5 pts)

- [ ] Write a comprehensive `CLAUDE.md` including:
  - Tech stack
  - Architecture decisions
  - Coding conventions
  - Testing strategy
  - Project-specific do's and don'ts
  - **At least one `@import`** reference to additional context (e.g., PRD, API docs, or this requirements file)
- [ ] Configure permissions (allowlists or sandboxing)
- [ ] Demonstrate `/init` output and iterate on `CLAUDE.md` based on it
- [ ] Show context management strategy (`/clear`, `/compact`, `--continue`)

### Part 2: Explore → Plan → Implement → Commit (30% / 15 pts)

Use Claude Code's 4-phase workflow on a real P3 feature:

- [ ] **Explore**: Use Glob, Grep, Read to understand existing code
- [ ] **Plan**: Use Plan mode to design the approach
- [ ] **Implement**: Execute the plan with Claude Code
- [ ] **Commit**: Create clean commits with meaningful messages
- [ ] **Requirement**: Git history must clearly show this workflow with **at least 3 commits**

### Part 3: TDD with Claude Code (30% / 15 pts)

Build a P3 feature using strict TDD through Claude Code:

- [ ] Write failing tests first (Red)
- [ ] Have Claude Code implement minimum code to pass (Green)
- [ ] Refactor
- [ ] Repeat for all acceptance criteria
- [ ] **Requirement**: Tests written BEFORE implementation; Git history and commit messages clearly show `red-green-refactor`

### Part 4: Reflection & Session Log (15% / 7.5 pts)

- [ ] Write a 1–2 page reflection answering:
  1. How does the Explore→Plan→Implement→Commit workflow compare to your previous approach?
  2. What context management strategies worked best?
- [ ] Include an **annotated Claude Code session log** showing the workflow

### HW4 Deliverables

1. P3 repository with `CLAUDE.md` and permissions configuration
2. Feature code with TDD git history (`red-green-refactor` commits)
3. Annotated Claude Code session log
4. Reflection document (1–2 pages)

---

## 📌 HW5: Custom Skill + MCP Integration (50 pts)

_Extend Claude Code directly within the P3 repository._

### Part 1: Custom Skill (50% / 25 pts)

- [ ] Create a custom Claude Code skill in `.claude/skills/` (e.g., `/fix-issue`, `/deploy`, `/add-feature`, `/review`)
- [ ] Include proper metadata (`name`, `description`), clear instructions, constraints, and expected behavior
- [ ] Test the skill on **at least 2 real tasks**
- [ ] Iterate on the skill based on results with **evidence of v1 → v2 improvement** (what changed and why)
- [ ] Capture screenshots or session logs showing skill execution on real tasks

### Part 2: MCP Integration (35% / 17.5 pts)

- [ ] Choose and connect at least 1 relevant MCP server (database MCP, Playwright, GitHub, Figma, etc.)
- [ ] Configure using `claude mcp add`
- [ ] Demonstrate at least 1 complete task using the MCP connection
- [ ] Document the setup process (how to reproduce) and what it enables

### Part 3: Retrospective (15% / 7.5 pts)

- [ ] Write a 1–2 page retrospective answering:
  1. How did the custom skill change your workflow? What tasks became easier?
  2. What did MCP integration enable that wasn't possible before?
  3. What would you build next (hooks, sub-agents, more skills)?

### HW5 Deliverables

1. GitHub repository including `.claude/skills/` with custom skill (v1 and v2 versions)
2. MCP server configuration and usage demonstration
3. Screenshots or session logs showing skill and MCP in action
4. Retrospective document (1–2 pages)

---

## 🚀 Project 3: Production Application with Claude Code Mastery (200 pts)

_Note: Individual grades may be adjusted up to ±10% based on contribution balance in commit history and PR reviews._

### 1. Application Quality & Architecture (40 pts)

- [ ] Production-ready, portfolio/interview-worthy application solving a real problem (new idea: **ReferFlow**)
- [ ] **2+ user roles** (Candidate / Referrer)
- [ ] Tech stack: Next.js (App Router) + PostgreSQL + Auth.js + Vercel deployment
- [ ] Deployed and accessible via public URL (with preview deploys)

### 2. Claude Code Mastery (55 pts)

- [ ] **CLAUDE.md & Memory**:
  - Comprehensive `CLAUDE.md` with `@imports` and Git evolution history
  - Auto-memory usage for persistent project context
- [ ] **Custom Skills (minimum 2)**:
  - Stored in `.claude/skills/` with team usage evidence (session logs or screenshots)
  - At least 1 skill iterated from v1 to v2 based on real usage (can reuse HW5)
- [ ] **Hooks (minimum 2)**:
  - Configured in `.claude/settings.json`
  - At least 1 `PreToolUse` or `PostToolUse` hook (e.g., auto-format, block protected files, lint-on-edit)
  - At least 1 quality-enforcement hook (e.g., `Stop` hook that runs tests)
- [ ] **MCP Servers (minimum 1)**:
  - Shared via `.mcp.json` in the repository with usage evidence (can reuse HW5)
- [ ] **Agents (minimum 1 — choose any)**:
  - Custom sub-agents in `.claude/agents/` (e.g., `security-reviewer`, `test-writer`, `docs-updater`), OR
  - Agent teams with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, OR
  - **Agent SDK** feature built into the application (also eligible for +4 Bonus)
  - Include usage evidence (session log, PR, or screenshots)
- [ ] **Parallel Development**:
  - Use Git worktrees to develop **at least 2 features in parallel** (visible in git branch history)
- [ ] **Writer/Reviewer Pattern + C.L.E.A.R.**:
  - At least 2 PRs using the writer/reviewer pattern (one agent writes, another reviews)
  - C.L.E.A.R. framework applied in PR review comments
  - AI disclosure metadata in PRs (% AI-generated, tool used, human review applied)

### 3. Testing & TDD (30 pts)

- [ ] Strict TDD (`red-green-refactor`) for **at least 3 features** with failing tests committed before implementation
- [ ] Unit + integration tests (Vitest or Jest)
- [ ] At least 1 E2E test (Playwright)
- [ ] **70%+ test coverage**

### 4. CI/CD & Production Security (35 pts)

- [ ] **GitHub Actions 8-stage pipeline (all green)**:
  1. Lint (ESLint + Prettier)
  2. Type checking (`tsc --noEmit`)
  3. Unit and integration tests
  4. E2E tests (Playwright)
  5. Security scan (`npm audit`)
  6. AI PR review (`claude-code-action` or `claude -p`)
  7. Preview deploy (Vercel)
  8. Production deploy on merge to `main`
- [ ] **Security Gates (minimum 4)**:
  - Pre-commit secrets detection (Gitleaks or equivalent)
  - Dependency scanning (`npm audit` in CI)
  - At least 1 SAST tool or security-focused sub-agent
  - Security acceptance criteria in Definition of Done
  - OWASP Top 10 awareness documented in `CLAUDE.md`

### 5. Pair Process (25 pts)

- [ ] **2+ sprints** documented (sprint planning + retrospective each)
- [ ] GitHub Issues with acceptance criteria as testable specifications
- [ ] Branch-per-issue workflow with PR reviews
- [ ] Async standups (minimum 3 per sprint per partner)
- [ ] C.L.E.A.R. framework and AI disclosure in PR reviews

### 6. Documentation & Demo (15 pts)

- [ ] Clear `README.md` with Mermaid architecture diagram
- [ ] Technical blog post (pair effort, published on Medium, dev.to, or similar)
- [ ] Video demonstration (**5–10 minutes**, showcasing app + Claude Code workflow)
- [ ] Individual reflections (one per partner, 500 words)
- [ ] Showcase submission via Google Form (project name, URLs, thumbnail, video, blog)

### 🌟 Bonus Opportunities (up to +10 pts)

- [ ] Property-based testing with `fast-check` (+3 pts)
- [ ] Mutation testing with `Stryker` (+3 pts)
- [ ] Agent SDK feature in app applying W13 patterns (+4 pts)
