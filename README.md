# ShareX-Plugins

Repository for [ShareX](https://github.com/akanshSirohi/ShareX) plugins (beta)

## Next.js starter

Use [sharex.starter.plugin](sharex.starter.plugin/README.md) to develop plugins on your computer with live ShareX messaging and storage. Enable plugin development in the app, copy the connection, and paste it into the starter. `npm run package` creates a static ZIP that can be installed from the app's Plugins screen.

## Project Setup

The root [apps.json](apps.json) lists plugins. Keep entries synchronized with plugin metadata and commit each distributable ZIP under `<package>/sharex_dist/<package>.zip`. See [AGENTS.md](AGENTS.md) for development and listing guidance.

- Clone the project

```bash
  git clone https://github.com/akanshSirohi/ShareX-Plugins.git
```

- Go to the project directory

```bash
  cd ShareX-Plugins
```

- Explore already exist plugins or `make your own.`
