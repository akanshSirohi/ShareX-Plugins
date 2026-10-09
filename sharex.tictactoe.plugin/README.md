# Side by Side · Tic Tac Toe

A two-player tic tac toe plugin for ShareX. One player opens a room and shares its six-character code; another joins with that code. Each open room has one host and one guest. There is no global room limit: different players can host rooms at the same time.

## Run with live ShareX

Use Node.js 22 or newer. From this folder:

```powershell
npm ci
npm run dev
```

On your phone, start ShareX sharing and enable **Plugin development** in Settings. Use the adjacent Share button to copy the connection. Open the local URL printed by Next.js, open the SDK's ShareX bubble, paste the connection, and connect. Repeat in a second browser or private window with the same plugin package. Keep the connection key out of source files and commits.

Once both browsers show **Connected to ShareX**, create a room in one and enter its code in the other. The host is X and goes first. The host validates moves and sends the current board to the guest. Rooms are private to browsers connected to the same ShareX instance and plugin namespace.

The SDK uses the ShareX WebSocket relay for direct browser-to-browser messages. It does not need an additional server or database. Development uses `dev.sharex.tictactoe.plugin`, separate from an installed plugin.

## Installable build

This project keeps the same static export and packaging commands as the starter:

```powershell
npm run package
npm test
```

The package command creates `sharex_dist/sharex.tictactoe.plugin.zip`, containing `config.json`, `index.html`, and static assets at its root. The version 1.0.1 ZIP is included. The package ID and repository folder are both `sharex.tictactoe.plugin` to match the catalog's download path. Install through the catalog or **Plugins > Install from ZIP** in ShareX and authorize the Tic Tac Toe plugin in the browser. Installed plugins automatically connect to the ShareX host serving them; no development connection is embedded.

The plugin is listed in the repository catalog. Keep `config.json` and `apps.json` synchronized when releasing updates.

## Notes

- ShareX must be running and both players must be connected to play.
- A room host can have one opponent at a time. When that guest leaves, the room resets and can accept another player.
- The host can start a rematch after a completed game.
- Closing the host browser ends the room. A reconnecting player can resume while their ShareX session remains available.
- The SDK relay messages do not include a server-attested sender identity. The game carries each browser UUID in its protocol packet and checks it against the room participant recorded by the host.
