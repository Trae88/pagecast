import assert from "node:assert/strict";
import test from "node:test";

import worker, {
  REACTIONS,
  applyReaction,
  applyView,
  emptyStats,
  parseDevice,
  refHost
} from "../feedback/worker.js";

test("parseDevice buckets user-agents into mobile/tablet/desktop", () => {
  assert.equal(
    parseDevice(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Mobile/15E"
    ),
    "mobile"
  );
  assert.equal(
    parseDevice("Mozilla/5.0 (Linux; Android 13; Pixel 7) Mobile Safari/537"),
    "mobile"
  );
  assert.equal(
    parseDevice("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605"),
    "tablet"
  );
  assert.equal(
    parseDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/605"),
    "desktop"
  );
  assert.equal(parseDevice(""), "desktop");
  assert.equal(parseDevice(undefined), "desktop");
});

test("refHost reduces referrers to a host bucket and collapses to direct", () => {
  assert.equal(refHost("https://twitter.com/some/path"), "twitter.com");
  assert.equal(refHost("https://www.google.com/"), "google.com");
  assert.equal(refHost(""), "direct");
  assert.equal(refHost(undefined), "direct");
  assert.equal(refHost("not a url"), "direct");
  // Same-origin navigation is not an external referrer.
  assert.equal(refHost("https://my.pages.dev/p/x/", "my.pages.dev"), "direct");
});

test("applyView accumulates immutably with coarse buckets", () => {
  let stats = emptyStats();
  stats = applyView(stats, { country: "us", ref: "twitter.com", device: "mobile" });
  stats = applyView(stats, { country: "US", ref: "twitter.com", device: "desktop" });
  stats = applyView(stats, {}); // missing fields fall back to XX/direct/desktop

  assert.equal(stats.views, 3);
  assert.equal(stats.countries.US, 2); // country is normalized to upper-case
  assert.equal(stats.countries.XX, 1);
  assert.equal(stats.referrers["twitter.com"], 2);
  assert.equal(stats.referrers.direct, 1);
  assert.equal(stats.devices.mobile, 1);
  assert.equal(stats.devices.desktop, 2);

  // Immutability: emptyStats() is not mutated.
  assert.equal(emptyStats().views, 0);
});

test("applyReaction only counts allowlisted emojis", () => {
  let stats = emptyStats();
  stats = applyReaction(stats, "🎉");
  stats = applyReaction(stats, "🎉");
  stats = applyReaction(stats, "👍");
  stats = applyReaction(stats, "<script>"); // ignored — not in the allowlist
  stats = applyReaction(stats, "💩"); // ignored — not in the allowlist

  assert.equal(stats.reactions["🎉"], 2);
  assert.equal(stats.reactions["👍"], 1);
  assert.equal(Object.keys(stats.reactions).length, 2);
  for (const emoji of Object.keys(stats.reactions)) {
    assert.ok(REACTIONS.includes(emoji));
  }
});

// Exercise the Worker fetch handler against an in-memory KV stub. This proves
// the view/react/stats contract without a live Cloudflare runtime.
function fakeKV() {
  const store = new Map();
  return {
    store,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, value);
    }
  };
}

function viewRequest(slug, { country = "US", ua = "iPhone Mobile", referer = "" } = {}) {
  const req = new Request("https://feedback.workers.dev/api/v1/view", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "user-agent": ua,
      ...(referer ? { referer } : {})
    },
    body: JSON.stringify({ slug })
  });
  // Cloudflare exposes geo on request.cf; emulate it.
  Object.defineProperty(req, "cf", { value: { country }, configurable: true });
  return req;
}

test("worker records a view with geo/referrer/device and rejects bad slugs", async () => {
  const env = { PAGECAST_FEEDBACK: fakeKV() };

  const ok = await worker.fetch(
    viewRequest("q3-report", { country: "GB", ua: "iPhone Mobile", referer: "https://twitter.com/x" }),
    env
  );
  assert.equal(ok.status, 200);
  const okBody = await ok.json();
  assert.equal(okBody.ok, true);
  assert.equal(okBody.views, 1);

  const stored = JSON.parse(env.PAGECAST_FEEDBACK.store.get("stats:q3-report"));
  assert.equal(stored.views, 1);
  assert.equal(stored.countries.GB, 1);
  assert.equal(stored.referrers["twitter.com"], 1);
  assert.equal(stored.devices.mobile, 1);

  const bad = await worker.fetch(viewRequest("../etc/passwd"), env);
  assert.equal(bad.status, 400);
});

test("worker react endpoint enforces the emoji allowlist", async () => {
  const env = { PAGECAST_FEEDBACK: fakeKV() };
  const make = (emoji) =>
    new Request("https://feedback.workers.dev/api/v1/react", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "plan", emoji })
    });

  const good = await worker.fetch(make("🚀"), env);
  assert.equal(good.status, 200);
  assert.equal((await good.json()).reactions["🚀"], 1);

  const evil = await worker.fetch(make("<img onerror=1>"), env);
  assert.equal(evil.status, 400);
});

test("worker stats endpoint is gated by the shared token", async () => {
  const env = { PAGECAST_FEEDBACK: fakeKV(), PAGECAST_STATS_TOKEN: "secret-123" };
  await worker.fetch(viewRequest("doc"), env);

  const unauth = await worker.fetch(
    new Request("https://feedback.workers.dev/api/v1/stats?slug=doc"),
    env
  );
  assert.equal(unauth.status, 401);

  const auth = await worker.fetch(
    new Request("https://feedback.workers.dev/api/v1/stats?slug=doc&token=secret-123"),
    env
  );
  assert.equal(auth.status, 200);
  const body = await auth.json();
  assert.equal(body.stats.views, 1);
});

test("worker serves the embeddable widget.js", async () => {
  const env = { PAGECAST_FEEDBACK: fakeKV() };
  const res = await worker.fetch(
    new Request("https://feedback.workers.dev/widget.js"),
    env
  );
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") || "", /javascript/);
  const src = await res.text();
  assert.match(src, /api\/v1\/view/);
  assert.match(src, /data-slug/);
});
