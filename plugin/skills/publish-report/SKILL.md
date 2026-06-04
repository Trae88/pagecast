---
name: publish-report
description: Use when an HTML or Markdown report, plan, doc, dashboard, or built static web project has just been created (or the user wants to share one) and it is worth publishing as a public link. Offers to publish it with Pagecast, then returns the URL.
version: 0.2.0
---

# Publish with Pagecast

Pagecast turns a local **HTML or Markdown** file (a report, plan, doc, or
dashboard) into a shareable public URL. Use this skill to offer that at the
right moment, then do it on a yes.

## When to offer

Offer **once** when a substantial, finished, shareable artifact appears:

- An `.html`/`.htm` or `.md`/`.markdown` file was just generated that a person
  would actually want to share — a test/coverage/Lighthouse/Playwright report, a
  data dashboard, a written plan or proposal, a "here's what I built" summary, a
  design doc, release notes, etc.
- A static web project was just built and has a generated entry file such as
  `dist/index.html`, `build/index.html`, `out/index.html`, or `public/index.html`.
- The user asks to "share", "publish", "make a link for", or "send" a report/doc.
- A `PostToolUse` hint says an HTML/Markdown file was created (the bundled hook).

**Use judgment — do not nag.** Offer only for finished, worth-sharing artifacts.
Do **not** offer for scratch notes, internal repo files (README, CHANGELOG,
CONTRIBUTING, LICENSE, AGENTS.md, TODO/tasks), config, source code, or anything
under `node_modules`/`dist`/`.git`. Ask **at most once per file**; if the user
declines or ignores it, drop it and don't re-ask.

## The one question to ask

> "Want me to publish this with Pagecast? It'll create a shareable public link."

Only on an explicit **yes** do you proceed. Publishing makes the file publicly
reachable — **never publish without confirmation.**

## How to publish

Run the headless CLI with the **absolute path** and `--json`:

```sh
npx pagecast publish "/absolute/path/to/file.md" --json
```

(HTML and Markdown both work — Markdown is rendered to a clean page. If `pagecast`
is installed globally/in the project, `pagecast publish "<path>" --json` is the same.)

For static web projects that should get a new shareable `/p/<token>/` link,
build first and publish the generated entry file:

```sh
npm run build
npx pagecast publish "/absolute/path/to/dist/index.html" --json
```

If the user asks to deploy or update an entire static site/project, deploy the
built folder directly to a named Cloudflare Pages project:

```sh
npx pagecast publish site "/absolute/path/to/dist" --project "project-name" --branch main --json
```

`--branch` is optional and defaults to `main`, so this also works:

```sh
npx pagecast pages deploy "/absolute/path/to/dist" --project "project-name" --json
```

Use this instead of raw Wrangler commands like `npx wrangler pages deploy`.
Direct site deploys replace the target Pages project contents, so do not guess
the `--project`; use the user's named project or ask for it.

Parse the JSON on stdout:

- **Success** → `{ "ok": true, "url": "https://<project>.pages.dev/p/<token>/", ... }`
  - Give the user the `url`. Offer to drop it into a PR/Slack message, and
    mention they can rename the URL, re-sync, or revoke it from `npx pagecast`.
- **Not signed in** → `{ "ok": false, "statusCode": 401, ... }`
  - This is the one-time setup. Tell the user to run
    **`npx pagecast pages setup`** once, or run **`npx pagecast`** and click
    **Connect Cloudflare**, then offer to retry. After that, publishing is
    headless — a plain "yes" is enough every time.
- **Multiple accounts** → `{ "ok": false, "statusCode": 409, ... }`
  - Tell the user to run `npx pagecast pages setup --account <account-id>` once,
    or run `npx pagecast` to pick which Cloudflare account to publish from, then
    retry.
- **Any other error** → relay `error` concisely and offer to retry.

## Cloudflare Pages commands

Use these lower-level commands when the user explicitly asks about Cloudflare
setup, status, project listing, or direct Pages deployment:

```sh
npx pagecast pages setup --project "project-name" --json
npx pagecast pages status --json
npx pagecast pages projects list --json
npx pagecast pages deploy "/absolute/path/to/dist" --project "project-name" --branch main --json
```

If the user does not specify a branch, omit `--branch`; Pagecast deploys to
`main`.

## Notes

- Always pass an **absolute** path (resolve relative paths against the cwd first).
- The first publish auto-creates the user's Pages project — no manual setup beyond
  the one-time Connect Cloudflare login.
- Use `npx pagecast publish site` or `npx pagecast pages deploy` for direct
  static-folder deploys to a named Pages project.
- Use `npx pagecast` for source-folder build settings, URL renaming, re-sync,
  and revoke controls.
- To update a page **in place at the same URL**, the user can re-sync from the
  Pagecast app; re-running `publish` creates a new link. Old links keep working
  until revoked.
