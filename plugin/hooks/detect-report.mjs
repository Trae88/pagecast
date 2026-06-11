#!/usr/bin/env node
// Passive PostToolUse hook: when a Write/Edit/MultiEdit creates or updates an
// HTML or Markdown file (a report, plan, doc, or dashboard) — or when a plan is
// finalized via ExitPlanMode — inject a non-blocking hint so the agent can offer
// to publish it with Pagecast. This hook NEVER blocks and NEVER publishes
// anything — it only adds context, and the skill decides whether the artifact is
// actually worth offering. Any error exits 0 silently so it can't disrupt the
// agent.

import { recordOffered } from "./lib-offered.mjs";

// Obvious non-artifacts the agent should not be nudged to publish. The skill
// applies the real judgment; this just keeps the common noise down.
const SKIP_BASENAMES = new Set([
  "readme.md",
  "readme.markdown",
  "changelog.md",
  "contributing.md",
  "license.md",
  "code_of_conduct.md",
  "security.md",
  "agents.md",
  "claude.md",
  "todo.md",
  "tasks.md",
  "notes.md"
]);

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(""));
  });
}

function reportPathFrom(toolInput) {
  if (!toolInput || typeof toolInput !== "object") {
    return null;
  }
  const candidate = toolInput.file_path || toolInput.path || toolInput.filePath;
  if (typeof candidate !== "string") {
    return null;
  }
  const lower = candidate.toLowerCase();
  const isPublishable =
    lower.endsWith(".html") ||
    lower.endsWith(".htm") ||
    lower.endsWith(".md") ||
    lower.endsWith(".markdown");
  if (!isPublishable) {
    return null;
  }

  const base = candidate.split("/").pop() || "";
  // Skip obvious non-artifacts: build/dependency dirs, hidden files, and common
  // repo-meta files that nobody wants to publish.
  if (
    candidate.includes("/node_modules/") ||
    candidate.includes("/dist/") ||
    candidate.includes("/.git/") ||
    base.startsWith(".") ||
    SKIP_BASENAMES.has(base.toLowerCase())
  ) {
    return null;
  }
  return candidate;
}

function emit(additionalContext) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext }
    })
  );
}

async function main() {
  try {
    const raw = await readStdin();
    if (!raw.trim()) {
      process.exit(0);
    }
    const event = JSON.parse(raw);
    const toolName = event.tool_name || event.toolName || "";

    // Plan-mode exit: a plan was just finalized. Plans are shareable docs
    // (proposals, design docs, "here's the plan") — offer to publish the plan
    // itself. The plan markdown lives in tool_input.plan.
    if (toolName === "ExitPlanMode") {
      const plan = event.tool_input?.plan;
      if (typeof plan === "string" && plan.trim().length > 200) {
        emit(
          `A plan was just finalized in plan mode. If this plan is something the user might ` +
            `want to share (a proposal, design doc, or roadmap), proactively offer ONCE — ask ` +
            `"Want me to publish this plan with Pagecast? I'll save it as a shareable page." ` +
            `On an explicit yes: write the plan markdown to a file (e.g. ./plan.md) and run ` +
            `\`npx pagecast publish "<abs path>.md" --json\`, then return the URL. Skip the offer ` +
            `for small/internal planning. Never publish without a yes; ask at most once.`
        );
      }
      process.exit(0);
    }

    // File writes: HTML/Markdown reports, docs, dashboards.
    const filePath = reportPathFrom(event.tool_input);
    if (!filePath) {
      process.exit(0);
    }

    emit(
      `A shareable HTML/Markdown file was just written at "${filePath}". ` +
        `Default action: when you finish this turn, proactively offer ONCE to publish it — ` +
        `ask the user exactly "Want me to publish this with Pagecast? It'll create a shareable public link." ` +
        `Offer unless the file is clearly internal/scratch (a draft note, a config/source file, or repo meta ` +
        `like README/CHANGELOG/TODO — those were already filtered, so lean toward offering). ` +
        `Do not stay silent just because you are unsure. ` +
        `Only on an explicit yes, run \`npx pagecast publish "${filePath}" --json\` and return the URL. ` +
        `Never publish without an explicit yes, and ask at most once for this file.`
    );
    // Mark it handled so the Stop-hook safety net doesn't nudge the same file.
    await recordOffered(event.session_id, [filePath]);
    process.exit(0);
  } catch {
    // Never disrupt the agent loop.
    process.exit(0);
  }
}

main();
