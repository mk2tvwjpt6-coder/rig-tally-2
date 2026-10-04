import {recognize,vision} from '../recognition.js';
// The build replaces this marker with the same files used by the local app.
const assets = /* HOSTED_ASSETS */ {};
const security={'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' data: blob:; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"};
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{...security,'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(request.method==='GET'&&url.pathname==='/api/status')return json(200,{recognitionConfigured:Boolean(env.OPENAI_API_KEY)});
  if(request.method==='POST'&&url.pathname==='/api/recognize'){
   const origin=request.headers.get('Origin');
   if(origin!==url.origin)return json(403,{error:'Open Rig Tally in your browser to scan.'});
   if(!env.OPENAI_API_KEY)return json(503,{error:'Photo scanning is awaiting configuration. Manual tally entry is available.'});
   const reader=request.body?.getReader();if(!reader)return json(400,{error:'Photo is required.'});
   let size=0;const chunks=[];
   try{
    while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>12*1024*1024){await reader.cancel();return json(413,{error:'Photo is too large. Choose a smaller image.'});}chunks.push(chunk.value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{return json(400,{error:'Invalid photo request.'});}
    if(typeof body.image!=='string'||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(body.image))return json(400,{error:'Use a JPEG, PNG or WebP photo.'});
    return json(200,await recognize(body.image,(image,instruction)=>vision(image,instruction,fetch,env)));
   }catch(error){return json(502,{error:error.message||'Scan failed. Saved tallies are unchanged.'});}
  }
  const asset=assets[url.pathname];if(request.method!=='GET'||!asset)return json(404,{error:'Not found.'});
  return new Response(asset.content,{headers:{...security,'Content-Type':asset.type}});
 }
};
