import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';

const plugin = JSON.parse(await readFile(new URL('../config.json', import.meta.url), 'utf8'));
const ref = process.argv[2] || 'master';
const archivePath = `${plugin.package}/sharex_dist/${plugin.package}.zip`;
const url = `https://api.github.com/repos/akanshSirohi/ShareX-Plugins/contents/${archivePath}?ref=${encodeURIComponent(ref)}`;
const response = await fetch(url, {
  headers: { Accept: 'application/vnd.github.v3.raw', 'User-Agent': 'ShareX-plugin-release-check' },
  signal: AbortSignal.timeout(30000),
});
assert.equal(response.status, 200, `Catalog download returned HTTP ${response.status}: ${archivePath}`);
const bytes = Buffer.from(await response.arrayBuffer());
assert.equal(bytes.subarray(0, 4).toString('hex'), '504b0304', 'Catalog response is not a ZIP');
const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
assert.ok(zip.file('index.html'), 'Downloaded ZIP is missing root index.html');
assert.ok(zip.file('config.json'), 'Downloaded ZIP is missing root config.json');
assert.deepEqual(JSON.parse(await zip.file('config.json').async('string')), plugin);
console.log(`${plugin.package} ${plugin.version}: GitHub download verified at ${ref}`);
