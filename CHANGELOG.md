# Changelog

All notable changes to Pagecast are documented here. This project follows
[semantic versioning](https://semver.org/).

## 0.2.0 — 2026-06-26

### Added

- **Memorable links** — published pages now get human-readable word-slugs
  (e.g. `/p/hollow-paperclip/`) instead of a random token tail. Links are
  long and hard-to-guess (private) by default. (#10)
- **Advanced publish settings** — a "Publish as a drop" toggle in the admin UI
  mints a short, shareable (guessable) link; the default stays a long,
  hard-to-guess private link. (#11)
- **Docker support** — a single image runs the dashboard *and* every
  publish/deploy command. Ships a Dockerfile, Compose file, and headless CLI
  usage with a scoped `CLOUDFLARE_API_TOKEN`. (#9)
- **Deploy history** — view and remove old whole-site Cloudflare Pages
  deployment snapshots from the admin UI (**Settings → Deploy history**) or the
  terminal: `pagecast pages deployments list|delete|prune`. (#6)
- **Anonymous usage telemetry (opt-out)** — reports only the command name,
  pagecast/Node version, and OS/arch; never file contents, paths, published
  URLs, or Cloudflare tokens. Off in CI by default; disable with
  `pagecast telemetry disable`, `PAGECAST_TELEMETRY=0`, or `DO_NOT_TRACK=1`. (#12)

### Fixed

- **Windows compatibility** — spawn `npx` via the shell and accept Windows-style
  paths so publish and deploy work on Windows. (#8)

## 0.1.6

- **Expiring URLs** — edge-enforced link expiry (default 30d, configurable via
  `--expires <7d|12h|never>`), enforced by a generated Cloudflare Pages
  Function. (#5)
