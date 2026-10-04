import {readFile,mkdir,writeFile} from 'node:fs/promises';
const assets={};
for(const [url,file,type]of [['/','index.html','text/html'],['/app.js','app.js','text/javascript'],['/tally.js','tally.js','text/javascript'],['/style.css','style.css','text/css']])assets[url]={content:await readFile(new URL('../public/'+file,import.meta.url),'utf8'),type};
const recognition=(await readFile(new URL('../recognition.js',import.meta.url),'utf8')).replaceAll('export ','');
const worker=(await readFile(new URL('../worker/index.js',import.meta.url),'utf8')).replace("import {recognize,vision} from '../recognition.js';",'').replace('/* HOSTED_ASSETS */ {}',JSON.stringify(assets));
await mkdir(new URL('../dist/server/',import.meta.url),{recursive:true});
await writeFile(new URL('../dist/server/index.js',import.meta.url),recognition+'\n'+worker);
console.log('Hosted app built from existing source.');
