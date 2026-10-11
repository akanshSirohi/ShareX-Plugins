# ShareX Notes

A Markdown notebook plugin for the ShareX Android app. The application is a fully static HTML/CSS/JS export, created from the provided ShareX plugin starter architecture and compatible with the package-based ShareX plugin installer. No server-side runtime, cloud account, remote APIs or external fonts are required.

## Features

- Rich Markdown source editor with Write, Preview and Split modes. The editor supports headings, inline formatting, links, fenced code, quotes, lists, checkboxes and tables in the preview.
- Mobile and desktop responsive UI, light and dark appearance.
- Create, rename, search and sort notes. Favorite, pin, archive, trash, restore and permanently delete notes.
- Tags, Markdown import, a single Download dropdown for `.md` and `.pdf` exports. PDFs download directly with embedded fonts, A4 margins, page numbers, and automatic page breaks. Split panes scroll together; navigation can collapse to a compact rail.
- Ctrl/Cmd+N new note, Ctrl/Cmd+K search, Ctrl/Cmd+S sync, Ctrl/Cmd+B bold and Ctrl/Cmd+I italic.
- Autosave using the ShareX SDK JSON database `notes` / collection `notes` (every note has a stable `_uuid`). Browser-local draft queue preserves edits made without an active ShareX connection and retries them when reconnected.
- SDK messaging notifies other connected instances to re-read their notes. Development pairing uses the ShareX SDK bubble; no connection string or credential is embedded.

## Install the ready-to-use ZIP

Install `sharex_dist/sharex.notes.plugin.zip` through ShareX **Plugins → Install from ZIP**. Start sharing and open the plugin from ShareX. Approve the plugin's ShareX storage and messaging permissions when prompted by the app. Sharing/permission must be active for phone-hosted database persistence. Local browser drafts work without a connection, but are specific to that browser until synchronized.

The ZIP contains `index.html`, `assets/` and `config.json` at the archive root. The archive may be installed directly; source files aren't needed on the phone.

## Local development

Requires Node.js 22+. With internet access, run `npm ci` to install the **published npm package** `sharex-sdk@1.2.1`. `npm run dev` serves the static notebook at `http://localhost:3000`; `npm run package` rebuilds and packages it. For SDK versions that support the built-in development bubble, start ShareX sharing, enable **Plugin development**, copy the connection in ShareX Settings, then paste it in the SDK bubble. On localhost, the plugin initializes with `{ development: { package_name: 'sharex.notes.plugin' } }` and automatically disconnects on page unload. Installed builds connect to their ShareX host without development options. The fallback SDK extracted from the uploaded starter is used only when `node_modules/sharex-sdk/dist/sharex-sdk.min.js` is unavailable at build time. It uses the same published ShareX SDK database API. Use the published package for the modern development connection bubble.

`npm run build` produces `out/`, and `npm run package` produces the ZIP at `sharex_dist/sharex.notes.plugin.zip`. `out/`, `node_modules/` are build artifacts and should not be committed. The installable ZIP should be committed when listed in a plugin catalog.

## Catalog

The plugin is listed in root `apps.json`; `catalog-entry.json` mirrors its metadata. The repository folder and package are both `sharex.notes.plugin`. The downloadable path is exactly `sharex.notes.plugin/sharex_dist/sharex.notes.plugin.zip`.

## Data & security notes

Note content is stored in ShareX plugin database; an offline browser cache and pending-write queue are also maintained in localStorage. If you share the phone with other authorized plugin browsers, data can be viewed by connected plugin sessions. Export important notes regularly. Plaintext Markdown is not encrypted. Markdown rendering escapes raw HTML and restricts generated link/image protocols to safe HTTP(S) and mailto links. Development credentials are supplied through the SDK bubble and must never be embedded in release assets. Deleting browser cache before synchronization will discard pending browser-only drafts.

### SDK storage compatibility

The published SDK 1.2.1 rejects `uuid: false`, so Notes supplies its stable `_uuid` and omits that insert option. Android updates use colon-delimited string commands, which cannot preserve empty fields, colons, or boolean types. Notes stores each complete document as URI-encoded JSON in the existing `content` field and decodes it on load. This also allows legacy records to migrate on their next edit without requiring a phone or SDK update. Browser drafts remain plain note objects and pending edits take precedence over server data.

## Limitations

- Requires the running ShareX phone to sync notes. There is no independent cloud synchronization service.
- Simultaneous edits to the same note in separate browsers use last successful write, so collaborative real-time editing is not guaranteed.
- The offline packaged fallback SDK was taken from the provided starter export; with `npm ci`, packaging instead uses the exact published version 1.2.1.

### PDF export

PDF generation runs entirely in the browser using bundled pdfmake and Roboto fonts, including Roboto Mono for code. Tables repeat their header row across pages; long code and identifiers wrap within page margins. Images are embedded when their host permits browser access. Unavailable images remain labeled links so an inaccessible image does not prevent the note from exporting. No print dialog or pop-up is required.
