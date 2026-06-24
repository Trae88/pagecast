// Pagecast telemetry Worker.
//
// One small Cloudflare Worker, deployed once to the maintainer's own account,
// that ingests anonymous CLI usage events (POST /api/v1/event) and writes them to
// a Workers Analytics Engine dataset. The pagecast CLI POSTs here when telemetry
// is enabled (see src/telemetry.js); users opt out with `pagecast telemetry
// disable`, PAGECAST_TELEMETRY=0, or DO_NOT_TRACK=1.
//
// Privacy: only the coarse, anonymous fields below are stored — the command run,
// pagecast/Node version, and OS/arch, plus a random opaque install id. No file
// contents, no file paths, no published URLs, no Cloudflare tokens/account IDs,
// no IP addresses. The Worker re-validates everything against fixed allowlists so
// it can never store arbitrary attacker-controlled strings or unbounded
// cardinality, regardless of what a client sends.
//
// The pure helpers are exported so they can be unit-tested under Node without a
// Workers runtime (see test/telemetry.test.js).

// Mirror of the CLI allowlists; the Worker trusts nothing from the client.
export const COMMAND_ALLOWLIST = [
  "serve",
  "publish",
  "pages",
  "feedback",
  "goal",
  "telemetry",
  "help",
  "version",
  "unknown"
];
const SUBCOMMAND_ALLOWLIST = {
  pages: ["setup", "status", "projects", "deploy", "deployments"],
  feedback: ["setup", "status"],
  goal: ["publish", "status", "stop"],
  telemetry: ["status", "enable", "disable"]
};
const OUTCOME_ALLOWLIST = ["started", "success", "error"];

export function cleanCommand(value) {
  const v = String(value || "").trim().toLowerCase();
  return COMMAND_ALLOWLIST.includes(v) ? v : null;
}

export function cleanSubcommand(command, value) {
  const allowed = SUBCOMMAND_ALLOWLIST[command];
  const v = String(value || "").trim().toLowerCase();
  return allowed && allowed.includes(v) ? v : "";
}

export function cleanOutcome(value) {
  const v = String(value || "").trim().toLowerCase();
  return OUTCOME_ALLOWLIST.includes(v) ? v : "started";
}

// Coarse free-ish fields (version, os, arch, node). Clamp the character set and
// length so they stay low-cardinality and can never carry a path or secret.
export function cleanField(value, maxLen = 32) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, maxLen);
}

// The anonymous install id is a 32-char hex string (16 random bytes). Anything
// else is dropped to empty.
export function cleanAnonId(value) {
  const v = String(value || "").trim().toLowerCase();
  return /^[a-f0-9]{32}$/.test(v) ? v : "";
}

// Turn a raw client payload into an Analytics Engine data point, or null if the
// command is not recognized (in which case the event is rejected).
export function buildDataPoint(payload = {}) {
  const command = cleanCommand(payload.command);
  if (!command) {
    return null;
  }
  const subcommand = cleanSubcommand(command, payload.subcommand);
  const outcome = cleanOutcome(payload.outcome);
  const version = cleanField(payload.version);
  const osName = cleanField(payload.os);
  const arch = cleanField(payload.arch);
  const node = cleanField(payload.node);
  const anonId = cleanAnonId(payload.anonId);
  return {
    // indexes: max 1, used for sampling/grouping. Keep it the command name.
    indexes: [command],
    blobs: [command, subcommand, outcome, version, osName, arch, node, anonId],
    doubles: [1]
  };
}

// --- Worker runtime (not exercised by the Node tests) ----------------------

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method === "POST" && url.pathname === "/api/v1/event") {
      const body = await request.json().catch(() => ({}));
      const dataPoint = buildDataPoint(body);
      if (!dataPoint) {
        return json({ ok: false, error: "bad event" }, 400);
      }
      // Best-effort write; never fail the request if the binding is absent.
      try {
        env.PAGECAST_TELEMETRY?.writeDataPoint(dataPoint);
      } catch {
        // Swallow — telemetry ingestion must not error noisily.
      }
      return json({ ok: true });
    }

    return json({ ok: false, error: "not found" }, 404);
  }
};
