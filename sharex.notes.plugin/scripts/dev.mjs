import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
const root=resolve(import.meta.dirname,'..');
if(!process.env.SKIP_BUILD){const result=spawnSync(process.execPath,[resolve(root,'scripts/build.mjs')],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
const out=resolve(root,'out');const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.map':'application/json'};
createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const abs=resolve(out,'.'+path,path.endsWith('/')?'index.html':'');if(!(abs===out||abs.startsWith(out+sep)))throw Error('Invalid path');const file=await readFile(abs);res.writeHead(200,{'Content-Type':types[extname(abs)]||'text/html','Cache-Control':'no-store'});res.end(file);}catch{res.writeHead(404);res.end('Not found');}}).listen(3000,'127.0.0.1',()=>console.log('ShareX Notes: http://localhost:3000'));
