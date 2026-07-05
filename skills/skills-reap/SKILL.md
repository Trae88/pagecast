---
name: skills-reap
description: Use when asked to reap, refresh, sync, audit, or clean up this repo's skills-lock.json — or when `npx skills add <source> -s '*'` reports a skill missing that was previously pinned. Pulls in every skill each pinned source repo publishes (not a curated subset), safety-scans what was fetched, prunes lockfile entries that no longer resolve upstream, links the survivors to the current coding agent, and keeps the README quick-start in sync.
---

# skills-reap

Maintenance routine for this repo's `skills-lock.json` (pinned third-party
Agent Skills, e.g. video/animation authoring tools — unrelated to Pagecast's
own product skill at `plugin/skills/publish-report/`). Run it end to end;
don't stop after the first step.

## 1. Restore + pull in everything new

This repo pins **every** skill each source repo publishes, not a curated
subset — don't cherry-pick. For each distinct `source` already in
`skills-lock.json`, install the full set:

```sh
npx skills add <source-repo> -s '*' --copy -y
```

This both restores existing pins (refreshing their `computedHash`) and adds
any skill the source repo has published since the last reap — the CLI
writes `skills-lock.json` itself, you don't hand-edit hashes. Compare
`git diff skills-lock.json` afterward to see exactly what's new vs. changed.

If a previously-pinned skill is missing from this run's output entirely
(not just hash-refreshed), the source repo removed it — see step 2.

## 2. Investigate every failure before touching the lockfile

For each failing entry, don't just delete it — find out what happened:

```sh
git clone <source-repo-url> /tmp/reap-check-<name>
cd /tmp/reap-check-<name>
git log --oneline --diff-filter=D --all -- "skills/<name>"
```

This finds the commit that removed the skill. Read its message/diff to see
whether it was a straight rename (something replaced it 1:1) or a real
consolidation/removal with no equivalent. **Never invent a mapping** — if
there's no clear 1:1 successor, treat the entry as gone, not renamed.

## 3. Safety-scan what actually got fetched

Installed skills run with full agent permissions, so before trusting new or
updated content, spot-check it:

```sh
grep -rniE "curl .*\| *sh|curl .*\| *bash|wget .*\| *sh|eval\(|base64 -d" .agents/skills/ 2>/dev/null
```

Flag anything suspicious to the user instead of silently accepting it — this
is a superficial check, not a substitute for actually reading a skill's
`SKILL.md` and scripts if the diff looks substantial.

## 4. Prune entries with no upstream equivalent

Edit `skills-lock.json`: remove entries confirmed gone in step 2 (no 1:1
successor). Keep everything else — including brand-new entries step 1 just
added — with the `computedHash` the CLI wrote.

## 5. Link the survivors to the current agent

`add -s '*'` without `-a` only restores into the canonical `.agents/skills/`
store — it does **not** make skills invocable by any specific agent. Link
them explicitly, grouped by source repo:

```sh
npx skills add <source-repo> -a claude-code --copy -y -s '*'
```

Repeat per distinct `source` in the lockfile. Use `-s '*'` (all skills from
that source), not a named subset. Use the agent name that matches whoever
is running this (`claude-code`, `cursor`, `codex`, etc. — see
`npx skills list` for the recognized names).

## 6. Keep the README in sync

If the set of skills or the commands above changed, update the quick-start
under `## Development` in `README.md` to match — keep the actual working
`add -a <agent> --copy -s ...` invocations there, not just
`experimental_install` (that alone leaves skills unlinked, a mistake this
repo made once already).

## 7. Report back

Tell the user, concretely:

- what's newly pinned this run (name + one-line description from its
  `SKILL.md`), and 2-3 concrete use cases for each new skill
- what was pruned and why (cite the upstream commit if found)
- what's still pinned and now linked
- how to use the skills **right now**: they land in `.claude/skills/`
  (or the equivalent for whatever agent you linked), which most agents
  pick up without a restart — but say so explicitly rather than assuming.
