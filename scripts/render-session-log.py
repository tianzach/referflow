"""Render a Claude Code JSONL session transcript as a markdown session log for docs/session-logs/.

Find your transcript:  ls -t ~/.claude/projects/*referflow*/*.jsonl ~/.claude/projects/*Project3*/*.jsonl
List tool calls:       python3 -I scripts/render-session-log.py SESSION.jsonl --index
Render with notes:     python3 -I scripts/render-session-log.py SESSION.jsonl notes.json [--stop-after=N] > docs/session-logs/<date>-<topic>.md
notes.json maps a tool-call number ("12") to markdown inserted before that call (your annotations).
Emails, home directories and scratchpad paths are scrubbed; still skim the output before committing.
"""
import json, re, sys

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[A-Za-z]{2,}\b")
HOME_RE = re.compile(r"/Users/[^/\s]+/")

def scrub(s: str) -> str:
    s = re.sub(r"<system-reminder>.*?</system-reminder>", "", s, flags=re.S)
    s = re.sub(r"<ide_opened_file>.*?</ide_opened_file>", "", s, flags=re.S)
    s = re.sub(r"/private/tmp/claude-\d+/[^\s\"']*?/scratchpad", "$SCRATCH", s)
    s = HOME_RE.sub("~/", s)
    s = EMAIL_RE.sub(lambda m: m.group(0) if m.group(0).startswith(("noreply@", "git@github")) else "<email>", s)
    return s.strip()

def short(s, n):
    lines = s.splitlines()
    out = "\n".join(lines[:n])
    if len(lines) > n:
        out += f"\n… ({len(lines) - n} more lines)"
    return out[:3000]

def tool_summary(name, inp):
    if name == "Bash":
        return inp.get("description", ""), inp.get("command", "")
    if name in ("Write", "Edit", "Read"):
        return inp.get("file_path", ""), (inp.get("content") or inp.get("new_string") or "")
    if name == "Agent":
        return f'{inp.get("subagent_type","")}: {inp.get("description","")}', inp.get("prompt", "")
    if name == "Skill":
        return inp.get("skill", ""), ""
    return "", json.dumps(inp)[:400]

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    index = "--index" in sys.argv
    stop_after = next((int(a.split("=")[1]) for a in sys.argv if a.startswith("--stop-after=")), 10**9)
    notes = json.load(open(args[1])) if len(args) > 1 else {}
    out, n = [], 0
    for line in open(args[0]):
        d = json.loads(line)
        if d.get("isSidechain"):
            continue
        t, m = d.get("type"), d.get("message")
        if t not in ("user", "assistant") or not isinstance(m, dict):
            continue
        content = m.get("content")
        if isinstance(content, str):
            content = [{"type": "text", "text": content}]
        for b in content or []:
            bt = b.get("type")
            if t == "user" and bt == "text":
                txt = scrub(b["text"])
                if not txt or txt.startswith("Please analyze this codebase"):
                    if txt.startswith("Please analyze"):
                        out.append("> **/init skill prompt loaded** (built-in instructions, omitted)\n")
                    continue
                if txt.startswith("Tool loaded") or txt.startswith("[SYSTEM NOTIFICATION"):
                    continue
                if txt.startswith("Another Claude session"):
                    rep = txt.split("The report follows:", 1)[-1].split("That \"other Claude session\"")[0]
                    rep = "\n".join(l[2:] if l.startswith("  ") else l for l in rep.splitlines()).strip()
                    rep = rep.split("</agent-message>")[0].strip()
                    out.append("### 🔎 Explore subagent report (returned to the main session)\n\n" + "\n".join("> " + l for l in rep.splitlines()) + "\n")
                    continue
                out.append(f"### 👤 User\n\n{txt}\n")
            elif t == "assistant" and bt == "text":
                txt = scrub(b["text"])
                if txt:
                    out.append(f"**🤖 Claude:** {txt}\n")
            elif t == "assistant" and bt == "tool_use":
                n += 1
                if n > stop_after:
                    out.append(f"\n---\n\n_Log ends after step {stop_after}. The remaining steps only generated this log and the HW4 docs._\n")
                    print("\n".join(out)); return
                title, body = tool_summary(b["name"], b.get("input", {}))
                title, body = scrub(title), scrub(body)
                if index:
                    print(n, b["name"], title[:90])
                    continue
                if str(n) in notes:
                    out.append(notes[str(n)] + "\n")
                out.append(f"<details><summary>🔧 #{n} {b['name']} — {title}</summary>\n\n```\n{short(body, 25)}\n```\n")
            elif t == "user" and bt == "tool_result":
                c = b.get("content")
                if isinstance(c, list):
                    c = "\n".join(x.get("text", "") for x in c if isinstance(x, dict))
                c = scrub(str(c or ""))
                if not index:
                    out.append(f"Result:\n```\n{short(c, 15)}\n```\n</details>\n")
    if not index:
        print("\n".join(out))

main()
