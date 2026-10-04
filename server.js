import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {recognize} from './recognition.js';
const assets={'/':'index.html','/app.js':'app.js','/tally.js':'tally.js','/style.css':'style.css'};
let active=0;
export const server=http.createServer(async(req,res)=>{
 const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 try{
  if(req.method==='POST'&&req.url==='/api/recognize'){
   if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`) return json(403,{error:'Origin not allowed.'});
   if(!process.env.OPENAI_API_KEY) return json(503,{error:'Photo recognition needs a server-side OpenAI API key. Manual tally entry is available.'});
   if(active>=2)return json(429,{error:'Two scans are already running. Try again shortly.'});
   active++;
   try{
    let raw='',size=0;
    for await(const chunk of req){size+=chunk.length;if(size>12*1024*1024) {json(413,{error:'Photo too large. Maximum request size is 12 MB.'});return;}raw+=chunk;}
    let body;try{body=JSON.parse(raw);}catch{return json(400,{error:'Invalid JSON request.'});}
    if(typeof body.image!=='string'||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(body.image))return json(400,{error:'Use a JPEG, PNG or WebP photo.'});
    return json(200,await recognize(body.image));
   }finally{active--;}
  }
  if(req.method==='GET'&&req.url==='/api/status')return json(200,{recognitionConfigured:Boolean(process.env.OPENAI_API_KEY)});
  const file=assets[req.url?.split('?')[0]];
  if(req.method!=='GET'||!file)return json(404,{error:'Not found.'});
  const bytes=await readFile(new URL(`./public/${file}`,import.meta.url));
  res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' data: blob:; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"});res.end(bytes);
 }catch(error){json(502,{error:error.message||'Scan failed. Your saved tally is unchanged.'});}
});
if(process.argv[1]===fileURLToPath(import.meta.url))server.listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log('Rig Tally ready on port '+(process.env.PORT||3000)));
