import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

test('built page requests the current content revision for every script and stylesheet', async () => {
  const html = await readFile(new URL('../out/index.html', import.meta.url), 'utf8');
  const assets = [...html.matchAll(/(?:src|href)="(assets\/[^"?]+\.(?:js|css))\?v=([a-f0-9]{12})"/g)];
  assert.equal(assets.length, 7);
  for (const [, path, revision] of assets) {
    const bytes = await readFile(new URL('../out/' + path, import.meta.url));
    assert.equal(revision, createHash('sha256').update(bytes).digest('hex').slice(0,12), path);
  }
});
