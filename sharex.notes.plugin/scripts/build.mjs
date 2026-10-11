import { cp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'out');
await rm(out,{recursive:true,force:true});
await cp(resolve(root,'src'),out,{recursive:true});
const compiled = resolve(root,'node_modules/sharex-sdk/dist/sharex-sdk.min.js');
const fallback = resolve(root,'src/assets/sdk-fallback.js');
let sdk = fallback;
try { await access(compiled); sdk = compiled; } catch {}
await cp(sdk,resolve(out,'assets/sdk.js'));
if (sdk === compiled) await cp(compiled + '.map', resolve(out,'assets/sharex-sdk.min.js.map'));
await rm(resolve(out,'assets/sdk-fallback.js'),{force:true});
await cp(resolve(root,'node_modules/pdfmake/build/pdfmake.min.js'),resolve(out,'assets/pdfmake.min.js'));
// Bundle fonts in the virtual file system; PDF export needs no CDN or font requests.
const { default: robotoFonts } = await import('pdfmake/build/vfs_fonts.js');
const mono = await readFile(resolve(root,'node_modules/@fontsource/roboto-mono/files/roboto-mono-latin-400-normal.woff'));
const pdfFonts = { ...robotoFonts, 'NotesMono.woff': mono.toString('base64') };
await writeFile(resolve(out,'assets/pdf-fonts.js'),`pdfMake.addVirtualFileSystem(${JSON.stringify(pdfFonts)});\npdfMake.addFonts(${JSON.stringify({Roboto:{normal:'Roboto-Regular.ttf',bold:'Roboto-Medium.ttf',italics:'Roboto-Italic.ttf',bolditalics:'Roboto-MediumItalic.ttf'},NotesMono:{normal:'NotesMono.woff',bold:'NotesMono.woff',italics:'NotesMono.woff',bolditalics:'NotesMono.woff'}})});\n`);
await cp(resolve(root,'node_modules/pdfmake/LICENSE'),resolve(out,'assets/pdfmake-LICENSE.txt'));
await cp(resolve(root,'node_modules/@fontsource/roboto-mono/LICENSE'),resolve(out,'assets/RobotoMono-LICENSE.txt'));
let html = await readFile(resolve(out,'index.html'),'utf8');
for (const match of [...html.matchAll(/(?:src|href)="(assets\/[^"?]+\.(?:js|css))"/g)]) {
  const asset = match[1];
  const revision = createHash('sha256').update(await readFile(resolve(out,asset))).digest('hex').slice(0,12);
  html = html.replace(match[0],match[0].replace(asset,`${asset}?v=${revision}`));
}
await writeFile(resolve(out,'index.html'),html);
console.log(`Static export: ${out} (ShareX SDK: ${sdk===compiled?'published npm 1.2.1':'starter bundle offline fallback'})`);
