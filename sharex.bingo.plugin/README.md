# Bingo · ShareX plugin

A live two-player Bingo game. One player creates a room and shares its six-character code; the other joins with that code. Each player gets a private, shuffled card containing the numbers 1–25. The host calls first, then players alternate calling one unmarked number at a time. Each call marks the number on both cards.

Each completed row, column, or full diagonal crosses off the next letter in B-I-N-G-O. Both corner-to-corner diagonals count. A single call can finish multiple lines and cross off multiple letters. The first player to complete at least five lines wins. If both reach five lines on the same call, the game is a draw. Each player sees only their own card and letter progress.

## Run with live ShareX

Use Node.js 22 or newer. From this folder:

```powershell
npm ci
npm run dev
```

On your phone, start ShareX sharing and enable **Plugin development** in Settings. Use the adjacent Share button to copy the connection. Open the local URL printed by Next.js, open the SDK's ShareX bubble, paste the connection, and connect. Repeat in a second browser or private window with the same package, create a room on one player, then join with the code on the other. Keep the connection key out of source files and commits.

The ShareX SDK relays game messages through its WebSocket connection. The private card layout stays on each player's browser; messages contain only the shared calls and whether a player has completed BINGO. The host validates turn order and call sequence, and waits for the other player's result on each call before settling a win or draw. Development uses `dev.sharex.bingo`, separate from an installed plugin.

After updating, refresh both players and create a fresh room so both use the revised rules and protocol.

Rule and turn checks can be run with `node --test tests/bingo.test.mjs`.

## Installable build

The starter packaging commands are available:

```powershell
npm run package
npm test
```

The package command creates `sharex_dist/sharex.bingo.zip`, containing `config.json`, `index.html`, and static assets at its root. The version 1.0.0 ZIP is included and listed in the repository catalog. Install it through **Plugins > Install from ZIP** in ShareX, then authorize Bingo in the browser. Installed plugins automatically connect to the ShareX host serving them; no development connection is embedded.
