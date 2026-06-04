---
name: publish-report
description: Publish finished local HTML, Markdown, or built static web projects with Pagecast. Use when the user asks Codex to publish, share, make a public link for, or send a local report/doc/dashboard/web project from terminal, Codex CLI, or Codex desktop, or when Codex has just created a substantial shareable .html, .htm, .md, .markdown, or static build output.
---

# Publish With Pagecast

## Overview

Use Pagecast to turn a finished local artifact into a shareable public URL backed
by the user's Cloudflare Pages project. Prefer the headless CLI for files and
built static output; use the Pagecast app when the user needs folder management,
URL renaming, re-sync, revocation, or source-folder build settings.

Never publish without explicit confirmation. Publishing makes the selected
artifact publicly reachable.

## What To Publish

Offer once for finished, shareable artifacts:

- HTML reports, dashboards, coverage reports, Playwright/Lighthouse output, or
  static single-page mini apps.
- Markdown reports, plans, docs, proposals, release notes, or summaries meant to
  be read by someone else.
- Static web projects after they are built. Publish the generated entry file,
  usually `dist/index.html`, `build/index.html`, `out/index.html`, or
  `public/index.html`; Pagecast stages sibling assets from that output folder.

Do not offer for scratch notes, source files, repo metadata, README/CHANGELOG,
AGENTS.md/CLAUDE.md, task files, secrets, config files, dependency/build folders,
hidden files, or anything the user has not made shareable.

## Confirmation

Ask one direct question before publishing:

```text
Want me to publish this with Pagecast?
```

Proceed only after an explicit yes. If the user declines or ignores the offer,
drop it and do not ask again for that artifact.

## Headless CLI Workflow

Resolve the target to an absolute path, then run:

```sh
npx pagecast publish "/absolute/path/to/report-or-built-index.html" --json
```

Markdown works too:

```sh
npx pagecast publish "/absolute/path/to/report.md" --json
```

For a web project:

1. Run the project's existing build command, such as `npm run build`, only if the
   user expects the current project state to be published.
2. Find the static output entry file, usually `dist/index.html`,
   `build/index.html`, `out/index.html`, or `public/index.html`.
3. Publish that entry file with `npx pagecast publish "<absolute-entry-path>" --json`.

Parse stdout as JSON:

- Success: `{ "ok": true, "url": "https://<project>.pages.dev/p/<token>/", ... }`
  Return the `url` and mention that the user can rename, re-sync, or revoke it
  from `npx pagecast`.
- `401`: the user has not connected Cloudflare. Tell them to run `npx pagecast`
  once and click **Connect Cloudflare**, then retry if they want.
- `409`: multiple Cloudflare accounts are available. Tell them to run
  `npx pagecast` once, choose the account, then retry.
- Other errors: relay the error concisely and do not claim success.

## App Workflow

Use the app when the user needs to manage folders or existing links:

```sh
npx pagecast
```

The app opens at `http://127.0.0.1:4173` and supports:

- Adding HTML/Markdown files.
- Adding deployable static folders.
- Adding source folders with an explicit build command and output directory.
- Publishing, renaming, re-syncing, and revoking URLs.

## Codex Usage Notes

- From Codex CLI or desktop, run terminal commands in the user's current project
  directory so `.pagecast/` config and publish history stay with that project.
- Always use absolute paths in `pagecast publish`.
- If the user asks only for a command, provide the command and any one-time setup
  note instead of running it.
- If the user asks Codex to publish, run the command after confirmation and
  report the resulting URL or exact failure.
