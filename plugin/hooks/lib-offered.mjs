// Tiny shared state so the PostToolUse and Stop hooks don't double-offer the same
// file. Keyed per session in the OS temp dir. Best-effort: any error is swallowed
// and treated as "nothing offered yet" so a hook never breaks the agent loop.
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

function stateFile(sessionId) {
  const id = String(sessionId || "default").replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(os.tmpdir(), `pagecast-offered-${id}.json`);
}

export async function loadOffered(sessionId) {
  try {
    const raw = await fs.readFile(stateFile(sessionId), "utf8");
    const list = JSON.parse(raw);
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

export async function recordOffered(sessionId, paths) {
  try {
    const set = await loadOffered(sessionId);
    for (const p of paths) {
      if (p) set.add(p);
    }
    // Cap so the file can't grow without bound in a long session.
    const capped = Array.from(set).slice(-300);
    await fs.writeFile(stateFile(sessionId), JSON.stringify(capped), "utf8");
  } catch {
    // best-effort
  }
}
