# ShareX plugin development

This repository contains plugins and the root `apps.json` catalog consumed by the Android app. Preserve `sharex.starter.plugin` as the working starter. Read its README before modifying development or packaging.

## Development

- Use Node.js 22 or newer and run `npm ci` in the plugin folder. Plugins, including the starter, must use the published `sharex-sdk` package from npm (currently pinned to `1.1.0` in the starter). Do not commit local `file:` dependencies or require a sibling SDK checkout. When upgrading the SDK, verify the published version, update the dependency and lockfile, and rebuild/test the plugin.
- Run `npm run dev` in the plugin folder. Enable Plugin development in ShareX and pair using the copied connection. Never commit development keys or embed them in production assets.
- Installed plugins require their own named ShareX permission for messaging and plugin storage. This grant must remain separate from browser approval for the shared file manager. Keep the direct-open permission page and the in-app request description accurate when changing plugin access.
- To create a plugin, copy the starter and update `config.json`, npm metadata, and UI. Use a unique dot-separated package containing letters, digits, and underscores; `dev.` is reserved.
- Keep plugins statically exportable: no server actions, API routes, or server-only runtime dependencies. Initialize the SDK in browser code, disconnect during React effect cleanup, and wait for successful database initialization before database operations.

## Packaging and proper listing

- `config.json` defines `name`, `package`, `description`, `author`, `version`, and positive integer `versionCode`.
- Run `npm run package` and `npm test` in the plugin folder. Commit `<package>/sharex_dist/<package>.zip` for every listed plugin. The app downloads this exact path. The ZIP must contain `config.json`, `index.html`, and static assets at its root without an enclosing directory.
- Root `apps.json` is a JSON array. Each entry must match its plugin's `config.json`; package identifiers must be unique. The filename is `apps.json`, not `app.json`.
- Update the catalog when adding, releasing, renaming, or removing a plugin. Increment `versionCode` for catalog releases, update `version` consistently, and rebuild the ZIP after metadata or production changes. Never list missing or stale archives.
- Remove a plugin folder and its catalog entry together. Keep the starter unless explicitly instructed otherwise.
- Before finishing, verify JSON validity, catalog/config equality, archive metadata and paths, and `git diff --check`. For production changes, verify installation, messaging, and storage on a device when available; report any device checks that were not performed.

Keep README instructions aligned with packaging and catalog behavior. Do not commit `node_modules`, `.next`, or unpacked `out` build directories.
