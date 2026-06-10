// Pagecast feedback Worker.
//
// One small Cloudflare Worker, deployed once to the user's own account, that
// backs every published page's reactions + view analytics. Published static
// pages embed `widget.js` (served from this Worker); the widget beacons a view
// and posts reactions here, and the Pagecast admin reads aggregate stats back.
//
// Storage: a single JSON aggregate per page slug in KV (binding PAGECAST_FEEDBACK),
// key `stats:<slug>`. Reads are one KV get; writes are get -> mutate -> put.
// Counts are best-effort under heavy concurrency (KV has no atomic increment) —
// acceptable for view/reaction analytics, and avoids the cost/complexity of D1.
//
// Privacy: only coarse, aggregate signals are stored — country (from Cloudflare's
// request.cf.country), referrer HOST (not full URL), and device class (from the
// User-Agent). No IP addresses, no cookies, no per-visitor records, no PII.
//
// The pure helpers below are exported so they can be unit-tested under Node
// without a Workers runtime (see test/feedback.test.js).

// The reactions a viewer can leave. Anything outside this allowlist is ignored,
// so the endpoint can't be used to store arbitrary attacker-controlled strings.
export const REACTIONS = ["👍", "❤️", "🎉", "🚀", "👀"];

export function emptyStats() {
  return { views: 0, reactions: {}, countries: {}, referrers: {}, devices: {} };
}

// Coarse device class from a User-Agent string. Intentionally simple — we only
// want mobile / tablet / desktop buckets, not fingerprinting.
export function parseDevice(userAgent) {
  const ua = String(userAgent || "").toLowerCase();
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(ua)) {
    return "tablet";
  }
  if (/mobi|iphone|ipod|android.*mobile|windows phone/.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

// Reduce a referrer to a host bucket. Unknown / same-origin / missing referrers
// collapse to "direct" so the breakdown stays meaningful.
export function refHost(referrer, selfHost = "") {
  const raw = String(referrer || "").trim();
  if (raw === "") {
    return "direct";
  }
  let host;
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    return "direct";
  }
  if (!host || (selfHost && host === String(selfHost).toLowerCase())) {
    return "direct";
  }
  // Drop a leading www. so example.com and www.example.com aggregate together.
  return host.replace(/^www\./, "");
}

function bump(map, key) {
  const k = key || "unknown";
  return { ...map, [k]: (map[k] || 0) + 1 };
}

// Apply a single view to an aggregate, returning a new aggregate.
export function applyView(stats, { country, ref, device } = {}) {
  const base = stats || emptyStats();
  return {
    ...base,
    views: (base.views || 0) + 1,
    countries: bump(base.countries || {}, (country || "XX").toUpperCase()),
    referrers: bump(base.referrers || {}, ref || "direct"),
    devices: bump(base.devices || {}, device || "desktop")
  };
}

// Apply a single reaction. Non-allowlisted emojis are ignored (returns the
// aggregate unchanged) so the store can't be polluted.
export function applyReaction(stats, emoji) {
  const base = stats || emptyStats();
  if (!REACTIONS.includes(emoji)) {
    return base;
  }
  return { ...base, reactions: bump(base.reactions || {}, emoji) };
}

// --- Worker runtime (not exercised by the Node tests) ----------------------

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS, ...extraHeaders }
  });
}

// Slugs come from the embedding page; keep them tame so they can't be abused as
// KV key injection or unbounded cardinality.
function cleanSlug(value) {
  const slug = String(value || "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{0,128}$/.test(slug) ? slug : null;
}

async function readStats(env, slug) {
  const raw = await env.PAGECAST_FEEDBACK.get(`stats:${slug}`);
  if (!raw) return emptyStats();
  try {
    return { ...emptyStats(), ...JSON.parse(raw) };
  } catch {
    return emptyStats();
  }
}

async function writeStats(env, slug, stats) {
  await env.PAGECAST_FEEDBACK.put(`stats:${slug}`, JSON.stringify(stats));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // widget.js — the client script every published page embeds.
    if (request.method === "GET" && url.pathname === "/widget.js") {
      return new Response(WIDGET_SOURCE, {
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "public, max-age=300",
          ...CORS
        }
      });
    }

    if (request.method === "POST" && url.pathname === "/api/v1/view") {
      const body = await request.json().catch(() => ({}));
      const slug = cleanSlug(body.slug);
      if (!slug) return json({ ok: false, error: "bad slug" }, 400);
      const stats = applyView(await readStats(env, slug), {
        country: request.cf?.country,
        ref: refHost(request.headers.get("referer"), url.hostname),
        device: parseDevice(request.headers.get("user-agent"))
      });
      await writeStats(env, slug, stats);
      return json({ ok: true, views: stats.views, reactions: stats.reactions });
    }

    if (request.method === "POST" && url.pathname === "/api/v1/react") {
      const body = await request.json().catch(() => ({}));
      const slug = cleanSlug(body.slug);
      if (!slug) return json({ ok: false, error: "bad slug" }, 400);
      if (!REACTIONS.includes(body.emoji)) {
        return json({ ok: false, error: "bad emoji" }, 400);
      }
      const stats = applyReaction(await readStats(env, slug), body.emoji);
      await writeStats(env, slug, stats);
      return json({ ok: true, reactions: stats.reactions });
    }

    // Aggregate stats for the admin. Gated by a shared secret so a page's slug
    // alone doesn't expose its analytics to the public.
    if (request.method === "GET" && url.pathname === "/api/v1/stats") {
      const token = env.PAGECAST_STATS_TOKEN;
      if (token && url.searchParams.get("token") !== token) {
        return json({ ok: false, error: "unauthorized" }, 401);
      }
      const slug = cleanSlug(url.searchParams.get("slug"));
      if (!slug) return json({ ok: false, error: "bad slug" }, 400);
      return json({ ok: true, slug, stats: await readStats(env, slug) });
    }

    return json({ ok: false, error: "not found" }, 404);
  }
};

// The client widget is written as a real function and serialized with
// toString(), so the Worker stays a single self-contained file (no bundler
// needed at deploy time) while the widget remains readable, lint-able source.
const WIDGET_SOURCE = `(${clientWidget.toString()})();`;

function clientWidget() {
  // NOTE: this function is serialized to a string and shipped to browsers, so it
  // must not reference anything outside its own scope (no imports, no closures).
  var s = document.currentScript;
  var base = s ? s.src.replace(/\/widget\.js.*$/, "") : "";
  var slug = (s && s.getAttribute("data-slug")) || "";
  if (!slug) return;
  var REACTIONS = ["👍", "❤️", "🎉", "🚀", "👀"];

  function post(path, body) {
    return fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true
    }).then(function (r) { return r.json(); }).catch(function () { return null; });
  }

  var counts = {};
  function render(bar) {
    bar.innerHTML = "";
    REACTIONS.forEach(function (emoji) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = emoji + (counts[emoji] ? " " + counts[emoji] : "");
      b.style.cssText =
        "font:14px system-ui;border:1px solid #e4e4e7;background:#fff;border-radius:999px;padding:4px 10px;cursor:pointer;line-height:1";
      b.onclick = function () {
        post("/api/v1/react", { slug: slug, emoji: emoji }).then(function (d) {
          if (d && d.reactions) { counts = d.reactions; render(bar); }
        });
      };
      bar.appendChild(b);
    });
  }

  var wrap = document.createElement("div");
  wrap.style.cssText =
    "position:fixed;right:16px;bottom:16px;display:flex;gap:6px;padding:6px;background:#fafafa;border:1px solid #e4e4e7;border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,.08);z-index:2147483647";
  render(wrap);
  document.body.appendChild(wrap);

  post("/api/v1/view", { slug: slug }).then(function (d) {
    if (d && d.reactions) { counts = d.reactions; render(wrap); }
  });
}
