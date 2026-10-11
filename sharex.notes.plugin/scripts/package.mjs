// Zero-dependency ZIP writer, compatible with Node.js 22 on Windows, macOS and Linux.
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, join, dirname } from 'node:path';
import { deflateRawSync } from 'node:zlib';
const root=resolve(import.meta.dirname,'..');
const plugin=JSON.parse(await readFile(resolve(root,'config.json'),'utf8'));
const files=[];
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const abs=join(dir,e.name);if(e.isDirectory())await walk(abs);else if(e.isFile())files.push({name:relative(resolve(root,'out'),abs).replaceAll('\\','/'),data:await readFile(abs)});}}
await walk(resolve(root,'out'));
files.push({name:'config.json',data:Buffer.from(JSON.stringify(plugin,null,2)+'\n')});
if(!files.some(f=>f.name==='index.html'))throw Error('Missing index.html');
for(const file of files){
  if(/\.(?:js|html|css|json|map)$/i.test(file.name)&&/sharex-dev-token=[a-f0-9]{64}/i.test(file.data.toString('utf8')))throw Error(`Development connection found in ${file.name}`);
}
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc32=b=>{let crc=0xffffffff;for(const v of b)crc=crcTable[(crc^v)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;};
const chunks=[],central=[];let offset=0;
for(const file of files){const name=Buffer.from(file.name);const compressed=deflateRawSync(file.data,{level:9});const crc=crc32(file.data);const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(8,6);local.writeUInt16LE(8,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(file.data.length,22);local.writeUInt16LE(name.length,26);chunks.push(local,name,compressed);const header=Buffer.alloc(46);header.writeUInt32LE(0x02014b50,0);header.writeUInt16LE(20,4);header.writeUInt16LE(20,6);header.writeUInt16LE(8,8);header.writeUInt16LE(8,10);header.writeUInt32LE(crc,16);header.writeUInt32LE(compressed.length,20);header.writeUInt32LE(file.data.length,24);header.writeUInt16LE(name.length,28);header.writeUInt32LE(offset,42);central.push(header,name);offset+=local.length+name.length+compressed.length;}
const centralSize=central.reduce((n,b)=>n+b.length,0);const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(centralSize,12);end.writeUInt32LE(offset,16);const dst=resolve(root,'sharex_dist',`${plugin.package}.zip`);await mkdir(dirname(dst),{recursive:true});await writeFile(dst,Buffer.concat([...chunks,...central,end]));console.log(`Plugin ZIP: ${dst}`);
