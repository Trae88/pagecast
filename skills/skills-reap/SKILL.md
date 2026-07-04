---
name: skills-reap
description: Use when asked to reap, refresh, sync, audit, or clean up this repo's skills-lock.json — or when `npx skills update`/`experimental_install` reports "Failed to update" entries. Restores the pinned skills, safety-scans what was fetched, prunes lockfile entries that no longer resolve upstream, links the survivors to the current coding agent, and keeps the README quick-start in sync.
---

# skills-reap

Maintenance routine for this repo's `skills-lock.json` (pinned third-party
Agent Skills, e.g. video/animation authoring tools — unrelated to Pagecast's
own product skill at `plugin/skills/publish-report/`). Run it end to end;
don't stop after the first step.

## 1. Restore + detect drift

```sh
npx skills experimental_install
# or, to also refresh hashes for entries that still resolve:
npx skills update
```

Read the output carefully. `✓ Updated <name>` means it still resolves
upstream. `✗ Failed to update <name>` means the source repo no longer has
that skill at the pinned path — usually a rename or a consolidation.

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
successor). Keep entries that still resolve, with their refreshed
`computedHash` from step 1.

## 5. Link the survivors to the current agent

`experimental_install`/`update` only restore into the canonical
`.agents/skills/` store — they do **not** make skills invocable by any
specific agent. Link them explicitly, grouped by source repo:

```sh
npx skills add <source-repo> -a claude-code --copy -y -s <skill1> <skill2> ...
```

Repeat per distinct `source` in the lockfile. Use the agent name that
matches whoever is running this (`claude-code`, `cursor`, `codex`, etc. —
see `npx skills list` for the recognized names).

## 6. Keep the README in sync

If the set of skills or the commands above changed, update the quick-start
under `## Development` in `README.md` to match — keep the actual working
`add -a <agent> --copy -s ...` invocations there, not just
`experimental_install` (that alone leaves skills unlinked, a mistake this
repo made once already).

## 7. Report back

Tell the user, concretely:

- what was pruned and why (cite the upstream commit if found)
- what's still pinned and now linked
- how to use the skills **right now**: they land in `.claude/skills/`
  (or the equivalent for whatever agent you linked), which most agents
  pick up without a restart — but say so explicitly rather than assuming.
