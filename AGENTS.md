# ShareX plugin development

This repository contains plugins and the root `apps.json` catalog consumed by the Android app. Preserve `sharex.starter.plugin` as the working starter. Read its README before modifying development or packaging.

## Development

- Use Node.js 22 or newer and run `npm ci` in the plugin folder. Plugins, including the starter, must use the published `sharex-sdk` package from npm. Do not commit local `file:` dependencies or require a sibling SDK checkout. The starter uses hosted SDK version `1.2.1`.
- Run `npm run dev` in the plugin folder. Enable Plugin development in ShareX. Open the SDK's draggable bubble, paste the connection copied from ShareX Settings, and use its status display to diagnose pairing. Never commit development keys or embed them in production assets.
- Installed plugins require their own named ShareX permission for messaging and plugin storage. This grant must remain separate from browser approval for the shared file manager. Keep the direct-open permission page and the in-app request description accurate when changing plugin access.
- To create a plugin, copy the starter and update `config.json`, npm metadata, and UI. Use a unique dot-separated package containing letters, digits, and underscores; `dev.` is reserved. Name the repository folder exactly after that package.
- Keep plugins statically exportable: no server actions, API routes, or server-only runtime dependencies. Initialize the SDK in browser code, disconnect during React effect cleanup, and wait for successful database initialization before database operations.
- For development, initialize the SDK with `development: { package_name: '<plugin.package>' }`. The SDK bubble collects the connection string without storing it in plugin source. If code supplies `development.server_url`, the bubble must show connection status only and identify that the string came from code. Do not recreate connection UI in each plugin unless a specific plugin workflow needs it.
- The starter's Next.js dev server aliases `sharex-sdk` to `../../SharexSDK/src/SharexSDK.js` when the sibling checkout exists. Production builds continue to use the published npm package. Preserve this split so SDK UI can be reviewed before release without adding a local SDK dependency to plugin metadata. Next dev must allow both `localhost` and `127.0.0.1` HMR origins to keep the local page connected to Fast Refresh.
- Manual connection steps: start ShareX sharing; enable **Plugin development** in Settings; use the adjacent Share button and **Copy connection**; open the plugin's local dev URL; open the SDK bubble; paste and connect. Check bubble status, browser Console and WebSocket entries, and the dev-server terminal when debugging. Remove keys and private payloads before sharing logs with AI tools.

## Packaging and proper listing

- `config.json` defines `name`, `package`, `description`, `author`, `version`, and positive integer `versionCode`.
- Run `npm run package` and `npm test` in the plugin folder. Commit `<package>/sharex_dist/<package>.zip` for every listed plugin. The app downloads this exact path. The ZIP must contain `config.json`, `index.html`, and static assets at its root without an enclosing directory.
- Root `apps.json` is a JSON array. Each entry must match its plugin's `config.json`; package identifiers must be unique. The filename is `apps.json`, not `app.json`.
- The repository folder must equal `config.json`'s package exactly. For package `sharex.bingo`, use `sharex.bingo/sharex_dist/sharex.bingo.zip`; adding a `.plugin` folder suffix breaks the Android catalog download URL. Verify the archive exists at that exact path before releasing.
- Update the catalog when adding, releasing, renaming, or removing a plugin. Increment `versionCode` for catalog releases, update `version` consistently, and rebuild the ZIP after metadata or production changes. Never list missing or stale archives.
- Remove a plugin folder and its catalog entry together. Keep the starter unless explicitly instructed otherwise.
- Before finishing, verify JSON validity, catalog/config equality, archive metadata and paths, and `git diff --check`. For production changes, verify installation, messaging, and storage on a device when available; report any device checks that were not performed.

Keep README instructions aligned with packaging and catalog behavior. Do not commit `node_modules`, `.next`, or unpacked `out` build directories.

### Required release checks

1. Read the Android catalog downloader before changing archive locations. It requests `<package>/sharex_dist/<package>.zip` from this repository. A package `sharex.bingo` must use folder `sharex.bingo`, not `sharex.bingo.plugin`. Preserve existing package identifiers when correcting a folder name.
2. Check every `apps.json` entry has exactly one matching `config.json`, a unique package, and an archive at the exact download path. Catalog name, package, description, author, version, and versionCode must match the config. Update npm package and lockfile versions consistently when releasing a new plugin version.
3. Run `npm run package` and `npm test` for each changed plugin. Include a regression test that reads the archive using the catalog's package-derived repository path. A test that only reads a ZIP relative to its own plugin folder misses catalog path errors.
4. Inspect the built ZIP, not only source or exported HTML. Confirm it is a real ZIP with root `config.json` and `index.html`, referenced JS/CSS assets exist under the correct installed route, archive metadata matches the catalog, and no embedded development credentials occur in any text asset. Commit only the intended plugin ZIP, excluding copied starter archives and build caches.
5. After pushing the branch, run `npm run check:download -- <branch>` in each changed game plugin. This checks the same GitHub Contents API path and raw response header used by Android, requires a successful HTTP response, checks ZIP bytes/CRC, and compares downloaded metadata with local config. A local ZIP test alone does not verify the hosted download. Repeat against `master` after merge when the merged release is available.
6. Run `git diff --check` and `git diff --cached --check`, inspect staged paths, and confirm both source and archives are included. Verify installation from the catalog and from a selected ZIP on a device when available. Report device checks that were not performed; do not describe automated archive checks as successful phone installation.

If the app reports `Unable To Parse Plugin!` during a catalog installation, first inspect the requested URL and HTTP response. The current downloader can save a GitHub error JSON as a `.zip`, which then produces this generic parse error. Missing repository paths and HTTP failures must be distinguished from invalid ZIP metadata.

### Branches and pull requests

- Use descriptive branch names such as `release/bingo-tictactoe` or `fix/game-plugin-installation`. The user requires that branch names, PR titles, and PR descriptions do not contain `codex`.
- Check whether the previous PR was merged before adding a release fix. If merged, start a fresh branch from the latest default branch and open a new PR. Keep generated archives and catalog changes in that PR, and describe the actual installation failure and validation results.
