# ShareX Next.js plugin starter

Develop on your computer while ShareX on your phone provides WebSocket messaging and a persistent JSON database. No source files need to be copied to the phone. The production build is a static plugin ZIP.

## Start development

Use Node.js 22 or newer. This starter uses the published [sharex-sdk npm package](https://www.npmjs.com/package/sharex-sdk), pinned to version `1.1.0`. Install dependencies directly in the starter folder; no SDK checkout is required.

```powershell
cd D:\Projects\ShareX-Plugins\sharex.starter.plugin
npm ci
npm run dev
```

1. Run the updated ShareX app and start sharing. Connect the computer and phone to the same Wi-Fi or hotspot.
2. In ShareX Settings, enable **Plugin development**. Wait for sharing to restart. Tap the connection button beside the switch and select **Copy connection**.
3. Open `http://localhost:3000` on your computer. Paste the copied connection into the starter and click **Connect**.
4. Open a second browser or private window, pair it, and try messaging. Add a note to test the plugin database. Edit `app/page.jsx`; Next.js refreshes the page automatically.

The connection includes the HTTP address and a development key in its URL fragment. The SDK connects to the next port: HTTP 6060 uses WebSocket 6061. The key authorizes plugin sockets only; it does not grant file-sharing access. Development data uses `dev.sharex.starter.plugin`, separate from installed plugin data. Disabling development or resetting the key revokes connections. Do not commit or share the key outside your development devices.

For a browser on the phone, open `http://YOUR_COMPUTER_LAN_IP:3000` and use the same connection. Allow Node through the computer firewall. For USB development, forward both ports with `adb forward tcp:6060 tcp:6060` and `adb forward tcp:6061 tcp:6061`, then replace the phone IP in the copied connection with `127.0.0.1`. Preserve the fragment containing the key. HTTPS ShareX uses `wss://`; trust the phone certificate for both ports before connecting. An HTTPS plugin page cannot connect to an HTTP ShareX socket.

## Make your plugin

Edit `config.json` first. The package controls the database namespace, installed directory, static asset prefix, and ZIP filename. Use dot-separated letters, digits, and underscores; `dev.` is reserved. Customize the page and SDK callbacks. Initialize the SDK only inside browser code, and call `disconnect()` during React effect cleanup. Perform database operations only after the database initialization callback reports `success`.

The starter includes:

- WebSocket connection status, reconnect handling, and connected browsers.
- Messages sent to other browsers using the same plugin.
- Persistent notes using the SDK database API.
- A pairing form available only during development.

## Build and install

```powershell
npm run package
npm test
```

This produces `sharex_dist/sharex.starter.plugin.zip`, with `config.json`, `index.html`, and `_next/` assets at the ZIP root. Production uses `/SharexApp/sharex-starter-plugin/` as its base path and automatically connects to the ShareX host that serves it. No development key is embedded in the build.

On the phone, open **Plugins > Install from ZIP**, select the ZIP, and confirm only if you trust its contents. Start sharing, authorize the browser in the normal ShareX portal, then open the installed plugin. Local ZIP installation can replace the same version; existing plugin database files remain. Increment `versionCode` for catalog releases.

Keep the plugin static: no server actions, API routes, or server-only runtime dependencies. See the [Next.js static export guide](https://nextjs.org/docs/app/guides/static-exports).

Use the published `sharex-sdk` npm package for new plugins too. When upgrading, update the pinned version and regenerate `package-lock.json`, then rebuild the plugin ZIP and run the packaging test.
