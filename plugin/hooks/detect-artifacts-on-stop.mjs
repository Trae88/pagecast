#!/usr/bin/env node
// Stop-hook safety net. The PostToolUse hook only catches files written via the
// Write/Edit/MultiEdit tools, so reports produced another way — `cat > out.html`
// in Bash, a build that emits `dist/index.html`, etc. — slip through. When a turn
// ends, this scans the working dir for freshly-written HTML/Markdown that wasn't
// already offered and surfaces a gentle "you can publish this" note. It NEVER
// blocks the agent and NEVER publishes; any error exits 0 silently.
import { promises as fs } from "node:fs";
import path from "node:path";
import { loadOffered, recordOffered } from "./lib-offered.mjs";

const SKIP_BASENAMES = new Set([
  "readme.md", "readme.markdown", "changelog.md", "contributing.md",
  "license.md", "code_of_conduct.md", "security.md", "agents.md",
  "claude.md", "todo.md", "tasks.md", "notes.md", "404.html", "index.md"
]);
const SCAN_DIRS = ["", "dist", "build", "out", "public", "site", "_site", "reports"];
const RECENT_MS = 3 * 60 * 1000; // modified within this turn
const MIN_BYTES = 200; // ignore trivial/placeholder files
const PUBLISHABLE = /\.(html?|md|markdown)$/i;

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve("");
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(""));
  });
}

function publishable(name, full) {
  const base = name.toLowerCase();
  if (!PUBLISHABLE.test(base)) return false;
  if (base.startsWith(".") || SKIP_BASENAMES.has(base)) return false;
  if (/\/(node_modules|\.git)\//.test(full)) return false;
  return true;
}

async function scan(dir, now) {
  const hits = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return hits;
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const full = path.join(dir, entry.name);
    if (!publishable(entry.name, full)) continue;
    try {
      const stat = await fs.stat(full);
      if (now - stat.mtimeMs <= RECENT_MS && stat.size >= MIN_BYTES) {
        hits.push(full);
      }
    } catch {
      // ignore
    }
  }
  return hits;
}

async function main() {
  try {
    const raw = await readStdin();
    if (!raw.trim()) process.exit(0);
    const event = JSON.parse(raw);
    // Avoid re-processing after a prior Stop-hook continuation.
    if (event.stop_hook_active) process.exit(0);

    const cwd = event.cwd || process.cwd();
    const now = Date.now();
    const found = [];
    for (const sub of SCAN_DIRS) {
      found.push(...(await scan(path.join(cwd, sub), now)));
    }
    const unique = Array.from(new Set(found));
    if (unique.length === 0) process.exit(0);

    const offered = await loadOffered(event.session_id);
    const fresh = unique.filter((p) => !offered.has(p));
    if (fresh.length === 0) process.exit(0);

    await recordOffered(event.session_id, fresh);

    const names = fresh.slice(0, 5).map((p) => path.basename(p));
    const list = names.join(", ") + (fresh.length > 5 ? ` (+${fresh.length - 5} more)` : "");
    const first = fresh[0];
    const systemMessage =
      `Pagecast: ${fresh.length === 1 ? "a shareable file was" : "shareable files were"} just created — ` +
      `${list}. Publish a public link with \`npx pagecast publish "${first}" --json\`, ` +
      `or ask Claude to publish it with Pagecast.`;

    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: "Stop", systemMessage }
      })
    );
    process.exit(0);
  } catch {
    process.exit(0);
  }
}

main();
