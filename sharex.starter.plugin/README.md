# ShareX Next.js plugin starter

Develop on your computer while ShareX on your phone provides WebSocket messaging and a persistent JSON database. No source files need to be copied to the phone. The production build is a static plugin ZIP.

## Start development

Use Node.js 22 or newer. Production builds use the published [sharex-sdk npm package](https://www.npmjs.com/package/sharex-sdk) version `1.2.1`. During `npm run dev`, Next.js uses `../../SharexSDK/src/SharexSDK.js` when that sibling SDK checkout exists, so upcoming SDK changes appear in the starter before publication. Without the sibling checkout, it falls back to the installed npm package. Keep both checkouts in their normal sibling folders for this local review mode.

```powershell
cd D:\Projects\ShareX-Plugins\sharex.starter.plugin
npm ci
npm run dev
```

1. Run the updated ShareX app and start sharing. Connect the computer and phone to the same Wi-Fi or hotspot.
2. In ShareX Settings, enable **Plugin development**. Wait for sharing to restart. Tap the Share button beside the switch and select **Copy connection**.
3. Open `http://localhost:3000` on your computer. Click the draggable ShareX bubble, paste the copied connection, and click **Connect**. The popup reports connection status.
4. Open a second browser or private window, connect it with the same steps, and try messaging. Add a note to test the plugin database. Edit `app/page.jsx`; Next.js refreshes the page automatically.

The connection includes the HTTP address and a development key in its URL fragment. The SDK connects to the next port: HTTP 6060 uses WebSocket 6061. The key authorizes plugin sockets only; it does not grant file-sharing access. Development data uses `dev.sharex.starter.plugin`, separate from installed plugin data. Disabling development or resetting the key revokes connections. Do not commit or share the key outside your development devices.

The connection includes the HTTP address and a development key in its URL fragment. The SDK connects to the next port: HTTP 6060 uses WebSocket 6061. The key authorizes plugin sockets only; it does not grant file-sharing access. Development data uses `dev.sharex.starter.plugin`, separate from installed plugin data. Disabling development or resetting the key revokes connections. Keep the key private and out of source files, commits, screenshots, and AI prompts.

## Make your plugin

Edit `config.json` first. The package controls the database namespace, installed directory, static asset prefix, and ZIP filename. Use dot-separated letters, digits, and underscores; `dev.` is reserved. Customize the page and SDK callbacks. Initialize the SDK only inside browser code, and call `disconnect()` during React effect cleanup. Perform database operations only after the database initialization callback reports `success`.

The starter includes:

- WebSocket connection status, reconnect handling, and connected browsers.
- Messages sent to other browsers using the same plugin.
- Persistent notes using the SDK database API.
- A development connection bubble supplied by ShareX SDK.

## Build and install

```powershell
npm run package
npm test
```

This produces `sharex_dist/sharex.starter.plugin.zip`, with `config.json`, `index.html`, and `_next/` assets at the ZIP root. Production uses `/SharexApp/sharex-starter-plugin/` as its base path and automatically connects to the ShareX host that serves it. No development key is embedded in the build.

On the phone, open **Plugins > Install from ZIP**, select the ZIP, and confirm only if you trust its contents. Start sharing, authorize the browser in the normal ShareX portal, then open the installed plugin. Local ZIP installation can replace the same version; existing plugin database files remain. Increment `versionCode` for catalog releases.

Keep the plugin static: no server actions, API routes, or server-only runtime dependencies. See the [Next.js static export guide](https://nextjs.org/docs/app/guides/static-exports).

Use the published `sharex-sdk` npm package for new plugins too. When upgrading, update the pinned version and regenerate `package-lock.json`, then rebuild the plugin ZIP and run the packaging test.
