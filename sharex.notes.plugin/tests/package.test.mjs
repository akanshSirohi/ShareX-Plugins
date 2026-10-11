import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import JSZip from 'jszip';
const root=resolve(import.meta.dirname,'..');
const metadata=JSON.parse(await readFile(resolve(root,'config.json'),'utf8'));
const catalog=JSON.parse(await readFile(resolve(root,'catalog-entry.json'),'utf8'));
const repository=resolve(root,'..');
const listing=JSON.parse(await readFile(resolve(repository,'apps.json'),'utf8'));
const entry=listing.find(item=>item.package===metadata.package);
assert.deepEqual(entry,metadata,'Repository catalog must list the plugin with matching metadata');
const path=resolve(repository,entry.package,'sharex_dist',`${entry.package}.zip`);
const archive=await readFile(path);
await JSZip.loadAsync(archive,{checkCRC32:true});
function entries(zip){let offset=0,result=new Map();while(offset<zip.length){const magic=zip.readUInt32LE(offset);if(magic===0x02014b50||magic===0x06054b50)break;assert.equal(magic,0x04034b50,'ZIP local file header');const method=zip.readUInt16LE(offset+8),packed=zip.readUInt32LE(offset+18),length=zip.readUInt32LE(offset+22),nameLen=zip.readUInt16LE(offset+26),extraLen=zip.readUInt16LE(offset+28);const name=zip.subarray(offset+30,offset+30+nameLen).toString('utf8');const start=offset+30+nameLen+extraLen;const input=zip.subarray(start,start+packed);const contents=method===8?inflateRawSync(input):input;assert.equal(contents.length,length,`Uncompressed size of ${name}`);result.set(name,contents);offset=start+packed;}return result;}
const files=entries(archive);
test('metadata/catalog/archive names are consistent with the ShareX download path',()=>{assert.deepEqual(catalog,metadata);assert.match(metadata.package,/^[a-z0-9_]+(?:\.[a-z0-9_]+)+$/);assert.equal(metadata.version,'1.0.0');assert.ok(Number.isInteger(metadata.versionCode)&&metadata.versionCode>0);assert.deepEqual(JSON.parse(files.get('config.json')?.toString('utf8')),metadata);assert.ok(path.replaceAll('\\','/').endsWith(`${metadata.package}/sharex_dist/${metadata.package}.zip`));});

test('every repository catalog entry has matching configuration and a valid archive at its package path',async()=>{
  assert.equal(new Set(listing.map(item=>item.package)).size,listing.length,'Catalog packages must be unique');
  for(const item of listing){
    const config=JSON.parse(await readFile(resolve(repository,item.package,'config.json'),'utf8'));
    assert.deepEqual(item,config,item.package);
    const zip=await JSZip.loadAsync(await readFile(resolve(repository,item.package,'sharex_dist',`${item.package}.zip`)),{checkCRC32:true});
    assert.ok(zip.file('index.html'),item.package);
    assert.deepEqual(JSON.parse(await zip.file('config.json').async('string')),item,item.package);
  }
});
test('production ZIP is flat, self-contained, and contains referenced CSS/JS',()=>{assert.ok(files.has('index.html'));const html=files.get('index.html').toString('utf8');assert.match(html,/<html/);for(const asset of [...html.matchAll(/(?:src|href)="(assets\/[^"#?]+)(?:\?[^"#]*)?"/g)].map(match=>match[1]))assert.ok(files.has(asset),`Missing ${asset}`);assert.ok(files.has('assets/sdk.js'));assert.ok(files.has('assets/app.js'));assert.ok(files.has('assets/styles.css'));assert.ok(!files.has('assets/sdk-fallback.js'));for(const name of files.keys())assert.ok(!name.startsWith(metadata.package+'/'),`Nested archive entry ${name}`);});
test('production bundle uses the SDK and does not embed private connection tokens',()=>{const js=files.get('assets/app.js').toString('utf8');const sdk=files.get('assets/sdk.js').toString('utf8');assert.match(js,/SharexSDK/);assert.match(js,/createDBInstance/);assert.match(js,/deleteById/);assert.ok(sdk.length>5000);for(const [name,bytes] of files){if(!/\.(js|html|css|json)$/.test(name))continue;assert.doesNotMatch(bytes.toString('utf8'),/sharex-dev-token=[a-f0-9]{64}/i,`Credential in ${name}`);} });
