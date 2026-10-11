/* Notes wire format for ShareX SDK 1.2.1 and its colon-delimited update protocol. */
(() => {
  'use strict';
  const PREFIX = 'sharex-notes-v1~';

  function toRecord(note) {
    // One nonempty, colon-free field preserves empty text, Unicode and JSON types.
    // Reuse content so legacy records already have the field required by updateById.
    return {_uuid: note._uuid, content: PREFIX + encodeURIComponent(JSON.stringify(note))};
  }

  function fromRecord(record) {
    if (typeof record.content !== 'string' || !record.content.startsWith(PREFIX)) return record;
    const note = JSON.parse(decodeURIComponent(record.content.slice(PREFIX.length)));
    if (!note || typeof note !== 'object' || Array.isArray(note)) throw new Error('Invalid stored note');
    return {...note, _uuid: record._uuid};
  }

  globalThis.SharexNotesStorage = Object.freeze({toRecord, fromRecord});
})();
