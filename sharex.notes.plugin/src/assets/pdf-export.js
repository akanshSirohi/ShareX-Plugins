(() => {
  'use strict';
  const WIDTH = 595.28 - 104;
  const INK = '#292633';
  const PURPLE = '#7756cf';
  // Long identifiers and URLs must wrap inside the printable width.
  const wrap = text => String(text).replace(/\S{28,}/gu, word => Array.from(word).join('\u200b'));

  function inline(node, style = {}) {
    if (node.nodeType === 3) return [{ text: wrap(node.textContent), ...style }];
    const tag = node.nodeName.toLowerCase();
    if (tag === 'br') return [{ text: '\n', ...style }];
    if (tag === 'input') return [{ text: node.hasAttribute('checked') ? '[x] ' : '[ ] ', ...style }];
    if (tag === 'img') return [{ text: `[Image: ${node.getAttribute('alt') || 'image'}]`, link: node.getAttribute('src'), color: PURPLE }];
    const next = { ...style };
    if (tag === 'strong' || tag === 'b') next.bold = true;
    if (tag === 'em' || tag === 'i') next.italics = true;
    if (tag === 'del') next.decoration = 'lineThrough';
    if (tag === 'code') Object.assign(next, { font: 'NotesMono', fontSize: 9, background: '#f1eef7', color: '#57416f' });
    if (tag === 'a' && /^(https?:\/\/|mailto:)/i.test(node.getAttribute('href') || '')) Object.assign(next, { link: node.getAttribute('href'), color: PURPLE, decoration: 'underline' });
    return [...node.childNodes].flatMap(child => inline(child, next));
  }

  function blocks(parent, images, width = WIDTH) {
    return [...parent.children].flatMap(node => {
      const tag = node.nodeName.toLowerCase();
      const heading = /^h([1-6])$/.exec(tag);
      if (heading) return [{ text: inline(node), fontSize: [20, 16, 13, 11.5, 11, 10.5][+heading[1] - 1], bold: true, lineHeight: 1.15, headlineLevel: +heading[1], margin: [0, 16, 0, 7] }];
      if (tag === 'hr') return [{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: width, y2: 0, lineWidth: 0.6, lineColor: '#ddd7e6' }], margin: [0, 10, 0, 10] }];
      if (tag === 'pre') {
        // Separate rows allow a long code block to continue across pages.
        return [{ table: { widths: ['*'], body: node.textContent.replace(/\t/g, '    ').split('\n').map(line => [{ text: wrap(line || ' '), font: 'NotesMono', fontSize: 8.5, lineHeight: 1.2, preserveLeadingSpaces: true, preserveTrailingSpaces: true, fillColor: '#f5f3f8' }]) }, layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 10, paddingRight: () => 10, paddingTop: i => i === 0 ? 9 : 1, paddingBottom: (i, table) => i === table.table.body.length - 1 ? 9 : 1 }, margin: [0, 3, 0, 12] }];
      }
      if (tag === 'blockquote') return [{ table: { widths: ['*'], body: [[{ stack: blocks(node, images, width - 22), color: '#625a70', fillColor: '#f7f4fb', margin: [0, 3, 0, 0] }]] }, layout: { hLineWidth: () => 0, vLineWidth: i => i === 0 ? 2 : 0, vLineColor: () => PURPLE, paddingLeft: () => 10, paddingRight: () => 10, paddingTop: () => 6, paddingBottom: () => 2 }, margin: [0, 2, 0, 12] }];
      if (tag === 'table') {
        const rows = [...node.querySelectorAll('tr')];
        const columns = Math.max(...rows.map(row => row.children.length));
        if (!columns) return [];
        const weights = Array.from({ length: columns }, (_, i) => Math.max(10, ...rows.slice(0, 30).map(row => Math.min(60, row.children[i]?.textContent.length || 0))));
        const total = weights.reduce((sum, value) => sum + value, 0);
        const padding = columns > 8 ? 3 : 7;
        const available = width - columns * padding * 2 - (columns + 1) * 0.5;
        const body = rows.map(row => Array.from({ length: columns }, (_, i) => ({ text: row.children[i] ? inline(row.children[i]) : '', bold: row.children[i]?.nodeName === 'TH', fillColor: row.children[i]?.nodeName === 'TH' ? '#eee9f6' : undefined })));
        return [{ table: { headerRows: node.querySelector('thead') ? 1 : 0, widths: weights.map(weight => Math.max(1, available * weight / total)), body }, fontSize: Math.max(7.5, 9.5 - Math.max(0, columns - 4) * 0.4), lineHeight: 1.2, layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#dcd6e5', vLineColor: () => '#dcd6e5', paddingLeft: () => padding, paddingRight: () => padding, paddingTop: () => 6, paddingBottom: () => 6 }, margin: [0, 3, 0, 12] }];
      }
      if (tag === 'ul' || tag === 'ol') {
        const items = [...node.children].map(item => ({ text: inline(item), margin: [0, 0, 0, 4], ...(item.classList.contains('task') ? { listType: 'none' } : {}) }));
        return [{ [tag]: items, margin: [0, 0, 0, 9] }];
      }
      if (tag === 'p') {
        // Images are standalone blocks so they can scale to the page.
        const parts = [], text = [];
        const flush = () => { if (text.length) { parts.push({ text: text.splice(0), margin: [0, 0, 0, 9] }); } };
        for (const child of node.childNodes) {
          if (child.nodeName === 'IMG' && images.has(child.getAttribute('src'))) {
            flush(); parts.push({ image: images.get(child.getAttribute('src')), fit: [width, 390], margin: [0, 4, 0, 12] });
          } else text.push(...inline(child));
        }
        flush(); return parts;
      }
      return [{ text: inline(node), margin: [0, 0, 0, 9] }];
    });
  }

  async function loadImages(document) {
    const images = new Map();
    await Promise.all([...new Set([...document.images].map(img => img.src))].map(src => new Promise(resolve => {
      const image = new Image();
      const finish = () => { clearTimeout(timer); image.onload = image.onerror = null; resolve(); };
      const timer = setTimeout(finish, 5000);
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        try {
          const canvas = globalThis.document.createElement('canvas');
          const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          images.set(src, canvas.toDataURL('image/png'));
        } catch { /* Preserve inaccessible images as labeled links. */ }
        finish();
      };
      image.onerror = finish;
      image.src = src;
    })));
    return images;
  }

  async function createDefinition(note, html) {
    const title = note.title.trim() || 'Untitled note';
    const document = new DOMParser().parseFromString(html, 'text/html');
    const images = await loadImages(document);
    const first = document.body.firstElementChild;
    if (first?.nodeName === 'H1' && first.textContent.trim() === title) first.remove();
    return {
      info: { title, creator: 'ShareX Notes' },
      pageSize: 'A4', pageMargins: [52, 48, 52, 48],
      defaultStyle: { font: 'Roboto', fontSize: 10.5, lineHeight: 1.3, color: INK },
      content: [{ text: wrap(title), fontSize: 26, bold: true, lineHeight: 1.1, margin: [0, 0, 0, 18] }, ...blocks(document.body, images)],
      footer: (page, pages) => ({ id: 'notes-pdf-footer', text: `${page} / ${pages}`, alignment: 'right', color: '#8b8397', fontSize: 8, margin: [52, 16, 52, 0] }),
      // pdfmake includes the footer among following nodes; ignore it for heading placement.
      pageBreakBefore: (node, following, next) => Boolean(node.headlineLevel && following.every(item => item.id === 'notes-pdf-footer') && next.some(item => item.id !== 'notes-pdf-footer'))
    };
  }

  async function createBlob(note, html) {
    if (!globalThis.pdfMake) throw Error('PDF export is unavailable. Reload the app and try again.');
    const definition = await createDefinition(note, html);
    return new Promise((resolve, reject) => {
      // Embedded fonts and image data keep this synchronous stream offline and catchable.
      const stream = pdfMake.createPdf(definition).getStream();
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(new Blob(chunks, { type: 'application/pdf' })));
      stream.end();
    });
  }
  globalThis.SharexNotesPdf = Object.freeze({ createDefinition, createBlob });
})();
