import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const JsonDBAdapter = require('sharex-sdk/src/JsonDBAdapter.js');
const context = vm.createContext({});
vm.runInContext(await readFile(new URL('../src/assets/note-storage.js', import.meta.url), 'utf8'), context);
const { toRecord, fromRecord } = context.SharexNotesStorage;
const plain = value => JSON.parse(JSON.stringify(value));

// Reproduce the installed Android handler's string update protocol. Exercise the
// real published SDK, including its callback dispatch and dot-notation conversion.
async function database(initial = []) {
  let rows = structuredClone(initial), adapter;
  const commands = [];
  const socket = { send(text) {
    const request = JSON.parse(text);
    commands.push(request);
    queueMicrotask(() => {
      const action = request.action.slice('db_action_'.length), data = request.data;
      if (action === 'init_db') {
        adapter.websocket_handleDBAction({ action: 'db_action_init_db_result', data: 'success' });
        return;
      }
      let result = { status: 'success' }, response = action + '_result';
      try {
        if (action === 'insert_data') rows.push(structuredClone(data.new_data));
        else if (action === 'get_all_data') result.data = structuredClone(rows);
        else if (action === 'update_data' || action === 'delete_data') {
          const id = data.query.match(/@\._uuid == '([^']+)'/)[1];
          if (action === 'delete_data') rows = rows.filter(row => row._uuid !== id);
          else {
            // Java String.split drops trailing empty values and the handler reads
            // only tokens 0 and 1. All update values become strings on Android.
            const changed = structuredClone(rows);
            for (const command of data.update) {
              const tokens = command.split(':');
              while (tokens.at(-1) === '') tokens.pop();
              if (tokens.length < 2) throw new Error('Empty update value');
              for (const row of changed.filter(row => row._uuid === id)) {
                if (Object.hasOwn(row, tokens[0])) row[tokens[0]] = tokens[1];
              }
            }
            rows = changed;
          }
        } else throw new Error('Unexpected SDK action');
      } catch { result = { status: 'fail' }; }
      adapter.websocket_handleDBAction({ action: 'db_action_' + response, data: JSON.stringify(result) });
    });
  } };
  await new Promise(resolve => { adapter = new JsonDBAdapter('notes', socket, (_action, status) => { assert.equal(status, 'success'); resolve(); }); });
  return { adapter, commands, call(method, ...args) { return new Promise(resolve => adapter[method](...args, resolve)); } };
}

const note = {
  _uuid: 'd54c4067-26bf-454a-9bc9-f1ec0ec06682', title: '', content: '', tags: '',
  pinned: false, favorite: false, archived: false, trashed: false,
  createdAt: '2026-10-10T17:20:30.000Z', updatedAt: '2026-10-10T17:20:30.000Z'
};

test('reproduces Android rejection of empty fields and truncation at colons', async () => {
  const db = await database([note]);
  assert.equal((await db.call('updateById', 'notes', note._uuid, { tags: '' })).status, 'fail');
  assert.equal((await db.call('updateById', 'notes', note._uuid, { content: 'https://example.com', pinned: true })).status, 'success');
  const stored = (await db.call('find', 'notes')).data[0];
  assert.equal(stored.content, 'https');
  assert.equal(stored.pinned, 'true');
});

test('SDK insert, update, reload and delete preserve the complete note', async () => {
  const db = await database();
  assert.equal((await db.call('insert', 'notes', toRecord(note))).status, 'success');
  assert.deepEqual(plain(fromRecord((await db.call('find', 'notes')).data[0])), note);
  const edited = { ...note, title: 'Ideas: नमस्ते ✨', content: '# Plan\n\n[Link](https://example.com/a:b)\n```yaml\nkey: value\n```\n', pinned: true, updatedAt: '2026-10-10T17:30:45.000Z' };
  assert.equal((await db.call('updateById', 'notes', note._uuid, { content: toRecord(edited).content })).status, 'success');
  const loaded = (await db.call('find', 'notes')).data;
  assert.equal(loaded.length, 1);
  assert.deepEqual(plain(fromRecord(loaded[0])), edited);
  const wire = db.commands.find(command => command.action === 'db_action_update_data').data.update;
  assert.equal(wire.length, 1);
  assert.equal(wire[0].split(':').length, 2);
  assert.equal((await db.call('deleteById', 'notes', note._uuid)).status, 'success');
  assert.deepEqual((await db.call('find', 'notes')).data, []);
});

test('legacy notes migrate using their existing content field and stable UUID', async () => {
  const legacy = { ...note, title: 'Existing note', content: 'Original text', tags: 'work' };
  assert.strictEqual(fromRecord(legacy), legacy);
  const db = await database([legacy]);
  const edited = { ...legacy, content: '', tags: '', favorite: true };
  assert.equal((await db.call('updateById', 'notes', legacy._uuid, { content: toRecord(edited).content })).status, 'success');
  assert.deepEqual(plain(fromRecord((await db.call('find', 'notes')).data[0])), edited);
});

test('Notes app flushes an existing browser draft and reloads it through the real SDK', async () => {
  const draft = { ...note, title: 'Offline edits', content: '[URL](https://example.com/a:b)\nनमस्ते', favorite: true };
  const cache = new Map([
    ['sharex.notes.v1.notes', JSON.stringify([draft])],
    ['sharex.notes.v1.pending', JSON.stringify({ [note._uuid]: { type: 'upsert', revision: 'offline-edit', note: draft } })],
    ['sharex.notes.v1.selected', JSON.stringify(note._uuid)]
  ]);
  const db = await database([{ ...note, content: 'Older server note' }]);
  const codecSource = await readFile(new URL('../src/assets/note-storage.js', import.meta.url), 'utf8');
  const appSource = await readFile(new URL('../src/assets/app.js', import.meta.url), 'utf8');
  const htmlSource = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
  const availableIds = new Set([...htmlSource.matchAll(/\bid="([^"]+)"/g), ...appSource.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

  async function browser() {
    const elements = new Map(), events = new Map(), timers = new Map(), warnings = [];
    let timerId = 0, sdkOptions;
    function element(id) {
      if (!elements.has(id)) elements.set(id, {
        value: '', innerHTML: '', textContent: '', dataset: {}, scrollHeight: 400, clientHeight: 400, scrollTop: 0,
        classList: { add() {}, remove() {}, toggle() {} }, focus() {},
        addEventListener(name, handler) { events.set(id + ':' + name, handler); }
      });
      return elements.get(id);
    }
    class SDK {
      connectionStatus = true;
      constructor(options) { sdkOptions = options; }
      init(handler) { queueMicrotask(() => handler('open')); }
      createDBInstance(name, handler) {
        assert.equal(name, 'notes');
        queueMicrotask(() => handler('init_db_result', 'success'));
        return db.adapter;
      }
      getAllUsers(handler) { handler([]); }
      getMyUUID() { return 'browser'; }
      disconnect() { this.connectionStatus = false; }
    }
    const page = vm.createContext({
      SharexSDK: SDK, console: { warn(message) { warnings.push(message); } }, crypto: globalThis.crypto, queueMicrotask,
      localStorage: { getItem(key) { return cache.get(key) ?? null; }, setItem(key, value) { cache.set(key, value); } },
      location: { hostname: 'localhost' },
      document: {
        getElementById(id) { return availableIds.has(id) ? element(id) : null; }, querySelector: element, querySelectorAll() { return []; },
        documentElement: { dataset: {} }, body: element('body'),
        addEventListener(name, handler) { events.set(name, handler); }
      },
      window: { innerWidth: 1200, addEventListener() {} },
      setTimeout(handler, delay) { const id = ++timerId; timers.set(id, { handler, delay }); return id; },
      clearTimeout(id) { timers.delete(id); }
    });
    vm.runInContext(codecSource, page);
    vm.runInContext(appSource, page);
    events.get('DOMContentLoaded')();
    await settle();
    assert.deepEqual(warnings, [], 'Connection initialization must work when removed DOM elements are absent');
    return { element, events, timers, sdkOptions };
  }

  const first = await browser();
  assert.equal(first.sdkOptions.development.package_name, 'sharex.notes.plugin');
  assert.equal(first.sdkOptions.development.server_url, undefined, 'Development pairing must use the SDK bubble');
  const save = [...first.timers.values()].find(timer => timer.delay === 900);
  assert.ok(save, 'Initial pending draft should schedule a save');
  await save.handler();
  assert.deepEqual(JSON.parse(cache.get('sharex.notes.v1.pending')), {});
  assert.deepEqual(plain(fromRecord((await db.call('find', 'notes')).data[0])), draft);
  assert.equal(db.commands.filter(command => command.action === 'db_action_insert_data').length, 0, 'Existing notes must update without duplicate insertion');
  assert.match(first.element('connection-badge').innerHTML, /Synced with ShareX/);

  const second = await browser();
  assert.equal(second.element('note-body').value, draft.content);
  assert.equal(JSON.parse(cache.get('sharex.notes.v1.notes'))[0].favorite, true);
});
