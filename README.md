# ShareX-Plugins

Repository for [ShareX](https://github.com/akanshSirohi/ShareX) plugins (beta)

## Next.js starter

Use [sharex.starter.plugin](sharex.starter.plugin/README.md) to develop plugins on your computer with live ShareX messaging and storage. Initialize the hosted SDK in development mode, then enter the connection copied from ShareX Settings in the SDK's draggable bubble. `npm run package` creates a static ZIP that can be installed from the app's Plugins screen.

## Set up your computer and phone

You need Git, Node.js 22 or newer with npm, a browser with developer tools, and the ShareX app with **Plugin development** and **Install from ZIP**. Connect your computer and phone to the same Wi-Fi or hotspot.

```powershell
git clone https://github.com/akanshSirohi/ShareX-Plugins.git
cd ShareX-Plugins/sharex.starter.plugin
npm ci
npm run dev
```

Keep the terminal running. Open the address printed by Next.js, normally `http://localhost:3000`. If that port is occupied, use the actual port printed in the terminal for the steps below.

Production builds use the published `sharex-sdk` npm package at `1.2.1`. The starter's dev server uses the sibling `SharexSDK` source checkout when available, so you can review SDK changes before publication. New plugins should use the npm package; do not add a local SDK dependency to plugin metadata.

1. Open ShareX on your phone and start sharing.
2. Open **Settings**, find the **Plugins** section, and enable **Plugin development**. Its switch and Share button sit in the row below the description. Wait for sharing to restart.
3. Tap the **Share** button beside the switch, then choose **Copy connection** in the dialog. Transfer the complete connection privately to your computer, including its URL fragment containing the development key.
4. Open the draggable SDK bubble in the starter, paste the connection, and click **Connect**. The bubble shows connection state and reconnect status.
5. Confirm the page reports **Connected to ShareX** and **Save note** becomes enabled after database initialization.

Keep the development key out of source files, commits, screenshots, logs, and AI prompts. Disabling development or resetting the key revokes access; copy a new connection before pairing again. ShareX's WebSocket uses the HTTP port plus one: HTTP 6060 means WebSocket 6061.

To open the dev page on the phone, use `http://YOUR_COMPUTER_LAN_IP:3000`, with the actual Next.js port. Allow Node.js through your computer firewall on the network you are using. `localhost` on the phone refers to the phone, so use the computer's LAN IP.

## Develop with an AI assistant

Open this repository in your editor or coding assistant. Have it read [AGENTS.md](AGENTS.md) and the [starter README](sharex.starter.plugin/README.md) first. Describe the feature, expected user behavior, and acceptance checks. You handle phone settings and pairing; the assistant can edit code, run terminal checks, and help interpret redacted errors.

For a new plugin, copy the starter into a new folder while preserving the original. Update `config.json` and npm metadata first. Choose a unique dot-separated package containing letters, digits, and underscores; `dev.` is reserved. The package determines the database namespace, installed route, static asset prefix, and ZIP filename.

Example prompt:

> Read AGENTS.md and the starter README. Create a plugin in sharex.notes.plugin using the published sharex-sdk npm dependency. Preserve the starter. Add a notes screen with persistent storage and clear connection states. Keep it compatible with static export. Run packaging and its tests, and provide manual checks for messaging, persistence, reconnects, and ZIP installation. Keep the catalog metadata and archive synchronized.

Work on one feature at a time. Edit `app/page.jsx` for behavior and `app/globals.css` for styles; Next.js refreshes the browser automatically. Initialize the SDK in browser code, disconnect during React effect cleanup, and wait for database initialization to report `success` before database operations. Keep plugins static: no server actions, API routes, or server-only runtime dependencies.

When asking the assistant to debug, provide the plugin package, reproduction steps, expected and actual results, terminal error, browser console error, and whether the issue occurs in development or after ZIP installation. Remove the connection key and private payloads. Have the assistant distinguish automated checks from phone/browser checks that you actually performed.

## Manually test live development

Try these checks with the unchanged starter first to confirm your setup, then repeat the relevant checks after making changes.

| Check | Manual steps | Expected result |
| --- | --- | --- |
| Pairing | Open the SDK bubble and connect the first browser with the copied connection. | Bubble reports connected; database controls enable after initialization. |
| Messaging | Open a second browser or private window, load the same dev page, and pair with the same connection and plugin package. Send a unique message in each direction. | Each other browser receives the message. The starter reports zero recipients when there are no peers. |
| Peer changes | Close the second browser, then reopen and pair it. | The connected-browser list updates when the peer leaves and returns. |
| Persistence | Save a uniquely named note. Refresh and pair again if prompted. | The saved note reappears from the phone database. Message history is in-memory and may disappear on refresh. |
| Shared storage | After the first browser saves a note, refresh and pair the second browser. | Both clients can read the note. The starter does not automatically refresh notes when another client writes. |
| Live edits | Change a visible label or style and save. | The browser updates without installing a ZIP. If a full reload loses the session, open the bubble and reconnect with the current connection. |
| Reconnect | Temporarily stop sharing or disconnect the network, then restore it. | The page shows connection loss and recovers. Test messaging and saving a new note again after recovery. |
| Revocation | Disable development or reset its key. Re-enable and copy a fresh connection. | Existing access is revoked; the fresh connection restores pairing. |

Development messaging and storage use `dev.<package>`; installed plugins use the normal package. Development notes should not appear in the installed plugin. Changing the package or database name also changes which data you see.

## Debug plugin problems

Open browser developer tools (usually F12). Use **Console** for JavaScript errors and **Network**, filtered to WebSocket/WS, to inspect socket handshakes and messages. Keep the Next.js terminal visible for build errors. Temporary logging in SDK and database callbacks helps identify the failing event or operation; avoid logging connection keys and private payloads.

| Symptom | What to check |
| --- | --- |
| Dev page cannot open | Confirm the dev server is running and use its printed port. On the phone, check the computer LAN IP, firewall, and whether the network isolates devices. |
| Page opens but pairing fails | Confirm sharing and development are enabled. Copy the full current connection again. Try the phone's ShareX HTTP address from the computer to check reachability, then check its next port for WebSocket. |
| HTTPS or mixed-content error | HTTPS ShareX requires `wss://`. Trust the phone certificate for both server ports. An HTTPS plugin page cannot connect to an insecure `ws://` socket. |
| Connected but messages do not arrive | Use two independent clients with the same plugin package. Check the peer list and send in both directions. Different packages and development/installed modes are isolated. |
| Saving stays disabled or fails | Check database initialization and operation callback results. An open socket alone does not mean the database is ready. Re-test after reconnect. |
| Notes seem missing | Check package, database name, phone, and development versus installed mode. Refresh the reader after another client writes; the starter has no live note subscription. |
| Duplicate peers or events after edits | Ensure the React effect disconnects the SDK in cleanup and does not create extra instances or handlers on each render. |
| ZIP build fails | Read the first actionable terminal error. Confirm dependencies installed and code supports static export. A working dev page does not guarantee a working static build. |
| Installed JS/CSS requests fail | Rebuild after package changes. Check asset requests use `/SharexApp/<package-with-dots-replaced-by-hyphens>/` and that the ZIP contains the referenced assets. Test through the installed ShareX route. |

For app-side failures, note which ShareX screen and action causes the issue. Share exact error text and reproduction steps with assistant. Redact connection key and private data.

## Build and manually test installation

From your plugin folder, run:

```powershell
npm run package
npm test
```

Packaging creates `sharex_dist/<package>.zip`. Run it before testing: the starter's test reads that archive and checks metadata, JS/CSS asset paths, and absence of the development-token marker. It does not exercise a real phone, messaging, or database persistence.

1. Transfer the ZIP to your phone.
2. Open ShareX **Plugins > Install from ZIP**, select it, and confirm installation for code you trust.
3. Start sharing. Open the normal ShareX portal in a browser and complete its authorization/password flow if required.
4. Open the installed plugin through ShareX or open its plugin URL directly. If this browser lacks permission, ShareX shows a plugin permission page. Approve the named plugin on the phone. This grants that plugin messaging and its own storage; opening the ShareX home page or file manager still asks for separate browser approval.
5. Repeat messaging and persistence tests in two browsers, approving the plugin for each browser. Check styles, asset loading, and connection recovery.
6. Save an installed-mode note, rebuild a change, and reinstall the same package. Verify the change appears and existing data remains. Local ZIP installation can replace the same version and preserves plugin database files.

Test the production plugin through ShareX, since the SDK infers its host and package from the installed URL. Opening `index.html` using `file://` or testing only the dev server does not verify that behavior. The ZIP must have `config.json`, `index.html`, and `_next/` assets at its root, without an enclosing folder.

## Maintain the plugin catalog

The root [apps.json](apps.json) is the catalog consumed by the Android app. Before a catalog release:

1. Update `config.json` with name, package, description, author, version, and positive integer `versionCode`. Increment `versionCode` for releases.
2. Keep the corresponding `apps.json` entry identical to the plugin metadata and package identifiers unique.
3. Rebuild, test, and include `<package>/sharex_dist/<package>.zip`. The app downloads this exact repository path.
4. Review `git status` and run `git diff --check`. Exclude `node_modules`, `.next`, unpacked `out`, and development keys. If a global ignore hides the ZIP, explicitly add that distributable using `git add -f`.
5. Record automated results and manual device checks, including checks you could not perform.

When removing a plugin, remove both its folder and catalog entry. Preserve the starter as the development reference. See [AGENTS.md](AGENTS.md) for maintenance rules.
