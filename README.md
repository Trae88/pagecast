# Pagecast

Preview local HTML reports, Markdown docs, and static mini apps, then publish
them to shareable Cloudflare Pages URLs — from the terminal or your coding agent.

**Feature HTML:** <https://pagecasthq.pages.dev/>

<p align="center">
  <img src="media/admin.png" alt="Pagecast admin UI: published reports with per-page password protection" width="900">
</p>

## About

Pagecast is a local-first publishing tool for agent-generated reports and small
static web projects. Preview files, manage published versions, rename links,
re-sync updates, password-protect pages, and revoke old URLs — from a local
admin UI or headless `pagecast` commands.

**Good fits:** HTML reports and dashboards (Playwright, Lighthouse, coverage);
Markdown plans, docs, and release notes; static mini apps from `dist`/`build`/`out`;
coding-agent workflows that publish a finished artifact on request.

**Not a fit:** private scratch notes, or server-rendered apps that need a running
backend (export static assets first).

## Quick Start

Requires Node.js 20+ and a Cloudflare account (for publishing). No global install:

```sh
npx pagecast
```

This starts the local app and opens the admin UI:

- Admin UI — `http://127.0.0.1:4173`
- Local published-page preview — `http://127.0.0.1:4174` (same `/p/<slug>/` shape it deploys)
- Local data/config — `.pagecast/` in the current directory

In the admin UI, click **Connect Cloudflare**. Pagecast uses scoped Wrangler
OAuth (`account:read`, `user:read`, `pages:write`), detects your account, and
creates the Pages project if needed. From a clone, run `npm start`.

Prefer containers? Pagecast ships with Docker support — see [Run with Docker](#run-with-docker).

Prefer the terminal?

```sh
npx pagecast pages setup --project pagecast
# multiple accounts? add  --account <account-id>
# automation? export CLOUDFLARE_API_TOKEN (scoped Pages:Edit) + CLOUDFLARE_ACCOUNT_ID
```

## Publish From The Terminal

```sh
# An HTML or Markdown file → a /p/<token>/ link (sibling assets included)
npx pagecast publish "/absolute/path/report.html" --json

# A built static project → publish its entry file
npm run build && npx pagecast publish "$(pwd)/dist/index.html" --json

# A whole folder → deploy directly to a named Pages project (--branch defaults to main)
npx pagecast pages deploy "$(pwd)/dist" --project pagecasthq --json
```

Add `--json` for agents and CI. Use the admin UI for link renaming, re-sync,
revoke, and build settings. Common errors: `statusCode 401` → run `pages setup`
or connect Cloudflare; `statusCode 409` → pass `--account <id>`.

## Password Protection

Gate any published page behind a password — from the admin UI (the **Password
protection** toggle) or headlessly:

```sh
npx pagecast publish "/absolute/path/report.html" --password "your-password" --json
npx pagecast publish "/absolute/path/report.html" --no-password --json   # remove it
```

Enforced at the edge by a generated Cloudflare Pages Function, so it covers every
file of a multi-file report and the page is never served unprotected. Crypto,
security model, and caveats: [PASSWORD-PROTECTION.md](PASSWORD-PROTECTION.md).

## Deploy History

Every publish or re-sync creates a new Cloudflare Pages deployment — an immutable
snapshot of your whole site at that moment, each with its own `<hash>.pages.dev`
URL. Over time these pile up. View and remove them from the admin UI
(**Settings → Deploy history**) or the terminal:

```sh
# List recent deployment snapshots (the newest production one is marked live)
npx pagecast pages deployments list --json

# Remove one snapshot by id (the live deployment is protected and can't be deleted)
npx pagecast pages deployments delete <id> --json

# Keep the N most recent (incl. live) and remove the rest
npx pagecast pages deployments prune --keep 5 --yes --json
```

Snapshots are whole-site, not per-page, so removing one never affects your live
site or your pages in Pagecast — it just frees up old `<hash>.pages.dev` URLs.

## Use From Coding Agents

Pagecast ships a Codex-native skill and a portable Agent-Skills file that offer
to publish finished artifacts — only after you confirm.

```sh
# Codex
cp -R .codex/skills/publish-report ~/.codex/skills/

# Claude Code
/plugin marketplace add Amal-David/pagecast
/plugin install pagecast@pagecast

# Any other agent
cp plugin/skills/publish-report/SKILL.md /path/to/your-agent/skills/publish-report/SKILL.md
```

More detail in [plugin/README.md](plugin/README.md).

## Run with Docker

A single image bundles the whole `pagecast` CLI, so it serves the admin dashboard
**and** runs every publish/deploy command — they are the same program.

```sh
# Serve the dashboard (build on first run, then open http://localhost:4173)
docker compose up --build
```

The local published-page preview is on `http://localhost:4174`, and your config +
publish history persist in `./.pagecast` (mounted as a volume).

**Publishing from a container uses an API token, not the dashboard's "Connect
Cloudflare" button** — that button opens a browser OAuth flow a container can't
complete. Copy `.env.example` to `.env`, add a scoped token, and `docker compose`
picks it up:

```sh
cp .env.example .env   # fill in CLOUDFLARE_API_TOKEN (+ CLOUDFLARE_ACCOUNT_ID)
```

Run any command headlessly (CI, servers) from the same image — mount your working
directory and pass the token through:

```sh
docker build -t pagecast .
docker run --rm -v "$PWD:/work" -w /work \
  -e CLOUDFLARE_API_TOKEN -e CLOUDFLARE_ACCOUNT_ID \
  pagecast publish ./report.html --json
```

Notes:

- The admin API is unauthenticated and can run shell commands, so the container
  binds `0.0.0.0` internally but the compose file maps the ports to the host's
  **loopback only** (`127.0.0.1`). Don't expose them on a routable interface.
- `wrangler` is pinned and baked into the image, so deploys don't fetch it at
  runtime. Bump `WRANGLER_VERSION` in the `Dockerfile` to update it.

## Chrome Extension (Experimental)

> ⚠️ Experimental — load-unpacked only, not yet on the Chrome Web Store.

When an agent opens an HTML file as `file:///…/report.html`, the bundled
extension adds a one-click **Publish to Pagecast** button (the running server
must be up). Install via `chrome://extensions` → **Developer mode** → **Load
unpacked** → select `extension/`, then enable **"Allow access to file URLs"**.
See [extension/README.md](extension/README.md).

## Admin UI Features

- Add `.html`/`.md` files by path or `file:///…` URL, deployable static folders,
  or source folders with a build command and output directory.
- Drag to reorder; publish, re-sync in place, rename links (old links redirect),
  or revoke one/all versions.
- Auto-sync path-backed reports; password-protect pages; edit HTML in-app without
  touching the original source file.
- View deploy history and remove old whole-site snapshots (the live deploy is
  protected), with a one-click "keep newest N" cleanup.

## Security Model

- Admin UI binds to `127.0.0.1`; draft previews are local-only.
- Public access only through active `/p/<token>/` links; revoked tokens 404 after
  the redeploy finishes.
- Public routes reject directory traversal and hidden files. Sibling assets in a
  report's folder can become public if referenced — keep secrets out of it.
- The Pages root publishes no report listing.

## Development

```sh
npm start                  # run the packaged app from source
npm run check && npm test  # verification suite
npm run build              # rebuild the React admin UI (web/) into public/
```

Work on the UI with Vite (`pnpm -C web run dev`, proxied to the server on 4173).
The root CLI/server has no runtime npm dependencies. Layout: `src/` (CLI, server,
publisher), `public/` (built UI), `web/` (React source), `plugin/` +
`.codex/skills/` (agent skills), `test/` (Node tests).

## Contributing

Issues and pull requests are welcome.

1. Fork and branch from `main`.
2. Make your change. Keep the root CLI/server free of runtime npm dependencies.
3. Run the verification suite before opening a PR:

   ```sh
   npm run check && npm test
   ```

4. Rebuild the admin UI if you touched anything under `web/`:

   ```sh
   npm run build   # regenerates public/
   ```

5. Open a PR describing what changed and why.

See the [Development](#development) section for the project layout. Please
**don't** file public issues for security problems — report them privately
via [SECURITY.md](SECURITY.md).

## License

MIT — see [LICENSE](LICENSE).
