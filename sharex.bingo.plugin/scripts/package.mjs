import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import JSZip from 'jszip';

const root = fileURLToPath(new URL('../', import.meta.url));
const plugin = JSON.parse(await readFile(path.join(root, 'config.json'), 'utf8'));
const zip = new JSZip();
async function addDirectory(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}${entry.name}`;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await addDirectory(absolute, `${relative}/`);
    else if (entry.isFile()) zip.file(relative, await readFile(absolute));
  }
}
await addDirectory(path.join(root, 'out'));
if (!zip.file('index.html')) throw new Error('Static export is missing index.html');
zip.file('config.json', JSON.stringify(plugin, null, 2));
const output = path.join(root, 'sharex_dist', `${plugin.package}.zip`);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log(`Plugin ZIP: ${output}`);
