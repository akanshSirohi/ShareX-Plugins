import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';

test('installable static export contains metadata and serves assets under the plugin route', async () => {
  const plugin = JSON.parse(await readFile(new URL('../config.json', import.meta.url), 'utf8'));
  const zip = await JSZip.loadAsync(await readFile(new URL(`../sharex_dist/${plugin.package}.zip`, import.meta.url)));
  assert.deepEqual(JSON.parse(await zip.file('config.json').async('string')), plugin);
  const html = await zip.file('index.html').async('string');
  const base = `/SharexApp/${plugin.package.replaceAll('.', '-')}`;
  const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css)[^"]*)"/g)].map((match) => match[1]);
  assert.ok(assets.length > 0);
  for (const asset of assets) {
    assert.ok(asset.startsWith(`${base}/_next/`), asset);
    assert.ok(zip.file(asset.slice(base.length + 1).split('?')[0]), asset);
  }
  assert.ok(!html.includes('sharex-dev-token='));
  const catalog = JSON.parse(await readFile(new URL('../../apps.json', import.meta.url), 'utf8'));
  assert.deepEqual(catalog.filter((entry) => entry.package === plugin.package), [plugin]);
  for (const entry of Object.values(zip.files)) {
    if (!entry.dir && /\.(?:js|json|html|css|map)$/.test(entry.name)) {
      assert.doesNotMatch(await entry.async('string'), /sharex-dev-token=[A-Za-z0-9]{32,}/, entry.name);
    }
  }
});
