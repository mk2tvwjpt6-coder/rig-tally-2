import {summarize,unusual} from './tally.js';
const $=id=>document.getElementById(id), storageKey='rig-tally-job-v1';
let job={company:'',well:'',string:'',start:1,sections:[],batches:[]},current=[],image=null,busy=false;
const say=text=>{$('message').textContent=text;};
try{const saved=localStorage.getItem(storageKey);if(saved)job=validateJob(JSON.parse(saved));}catch{say('Could not load the saved job. Restore a downloaded backup if needed.');}
function clearPhoto(){image=null;$('photo').value='';$('preview').hidden=true;$('scan').disabled=true;$('rotate').disabled=true;}
function allEntries(){return job.batches.flatMap(b=>b.entries);}
function persist(next){localStorage.setItem(storageKey,JSON.stringify(next));job=next;}
function validateJob(value){
 if(!value||!Array.isArray(value.batches)||!Array.isArray(value.sections)||!Number.isInteger(value.start)||value.start<1||!['company','well','string'].every(k=>typeof value[k]==='string'))throw Error('Invalid job backup.');
 if(!value.sections.every(s=>typeof s.size==='string'&&Number.isInteger(s.count)&&s.count>0))throw Error('Invalid tubing sections.');
 if(!value.batches.every(b=>typeof b.run==='boolean'&&Array.isArray(b.entries)&&b.entries.every(e=>Number.isFinite(e.length)&&e.length>0&&['auto','singles','stands'].includes(e.mode))))throw Error('Invalid batch data.');
 summarize(value.batches.flatMap(b=>b.entries),value.sections,value.start);return value;
}
function populate(){for(const k of ['company','well','string','start'])$(k).value=job[k];$('sections').value=job.sections.map(s=>`${s.size}, ${s.count}`).join('\n');renderTotals();}
function saveJob(){
 const sections=$('sections').value.trim().split('\n').filter(Boolean).map(line=>{const index=line.lastIndexOf(',');const size=line.slice(0,index).trim(),count=Number(line.slice(index+1));if(index<1||!size||!Number.isInteger(count)||count<1)throw Error('Use size, total joint count for each section.');return {size,count};});
 const next={...job,sections,start:Number($('start').value)};for(const k of ['company','well','string'])next[k]=$(k).value;
 validateJob(next);persist(next);renderTotals();
}
function renderTotals(){
 const total=summarize(allEntries(),job.sections,job.start);$('stats').replaceChildren();
 for(const [value,label]of [[total.entries,'Entries'],[total.joints,'Actual joints'],[total.feet.toFixed(2),'Total feet']]){const box=document.createElement('div'),b=document.createElement('b'),span=document.createElement('span');b.textContent=value;span.textContent=label;box.append(b,span);$('stats').append(box);}
 $('batches').replaceChildren();job.batches.forEach((batch,i)=>{const div=document.createElement('div');div.className='batch';const text=document.createElement('p');text.textContent=`Batch ${i+1} · ${batch.entries.length} entries · ${batch.run?'Run in hole':'Ready to run'}`;const button=document.createElement('button');button.className='secondary';button.textContent=batch.run?'Mark not run':'Mark run';button.onclick=()=>{try{const next=structuredClone(job);next.batches[i].run=!next.batches[i].run;persist(next);renderTotals();}catch(e){say(e.message);}};div.append(text,button);$('batches').append(div);});
}
function crop(box){if(!image||!box)return null;const c=document.createElement('canvas'),w=image.width,h=image.height;c.width=Math.max(1,Math.round((box[2]-box[0])*w));c.height=Math.max(1,Math.round((box[3]-box[1])*h));c.getContext('2d').drawImage(image,box[0]*w,box[1]*h,c.width,c.height,0,0,c.width,c.height);return c.toDataURL('image/jpeg');}
function renderReview(){
 $('review').hidden=false;$('rows').replaceChildren();$('reviewSummary').textContent=`${current.length} occupied positions detected. Compare these with your sheet before saving.`;
 current.forEach((entry,index)=>{
  const row=document.createElement('div');row.className='entry'+(entry.needsReview?' flagged':entry.length&&unusual(entry.length,entry.mode)?' unusual':'');
  const title=document.createElement('b');title.textContent=`Position ${entry.position}${entry.needsReview?' · check handwriting':entry.length&&unusual(entry.length,entry.mode)?' · unusual length':''}`;row.append(title);
  const cropped=crop(entry.bbox);if(cropped){const img=document.createElement('img');img.src=cropped;img.alt=`Handwriting at position ${entry.position}`;row.append(img);}
  const grid=document.createElement('div');grid.className='grid';const label=document.createElement('label');label.textContent='Length (ft)';const input=document.createElement('input');input.type='number';input.step='.01';input.min='.01';input.value=entry.length??'';input.onchange=()=>{entry.length=input.value===''?null:Number(input.value);entry.confirmed=false;renderReview();};label.append(input);
  const modeLabel=document.createElement('label');modeLabel.textContent='Joint count';const select=document.createElement('select');for(const [value,text]of [['auto','Mixed / automatic'],['singles','Single — 1 joint'],['stands','Stand — 2 joints']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}select.value=entry.mode;select.onchange=()=>{entry.mode=select.value;entry.confirmed=false;renderReview();};modeLabel.append(select);grid.append(label,modeLabel);row.append(grid);
  if(entry.alternatives){const p=document.createElement('p');p.className='hint';p.textContent='Scan readings: '+entry.alternatives.map(v=>v===null?'unclear':v.toFixed(2)).join(' / ');row.append(p);}
  const checkLabel=document.createElement('label');checkLabel.className='check';const cb=document.createElement('input');cb.type='checkbox';cb.checked=Boolean(entry.confirmed);cb.onchange=()=>{entry.confirmed=cb.checked;};checkLabel.append(cb,document.createTextNode('I checked this entry against the sheet'));row.append(checkLabel);
  const remove=document.createElement('button');remove.className='secondary';remove.textContent='Remove entry';remove.onclick=()=>{if(confirm('Remove this entry from the batch?')){current.splice(index,1);renderReview();}};row.append(remove);$('rows').append(row);
 });
}
function guard(action){return async()=>{try{await action();}catch(e){say(e.message);}};}
$('saveJob').onclick=guard(()=>{saveJob();say('Job saved.');});
$('photo').onchange=guard(async()=>{
 if(busy)throw Error('Wait for the current scan to finish.');
 if(current.length&&!confirm('Replace the current unverified review?'))return;
 const file=$('photo').files[0];if(!file)return;
 if(file.size>20*1024*1024)throw Error('Choose a photo smaller than 20 MB.');
 const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height));
 const c=$('preview');c.width=Math.round(bitmap.width*scale);c.height=Math.round(bitmap.height*scale);c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);bitmap.close();image=c;c.hidden=false;current=[];$('review').hidden=true;$('scan').disabled=false;$('rotate').disabled=false;
 say(Math.min(c.width,c.height)<900?'Small photo: handwriting may be hard to read. Consider retaking closer.':'Photo ready. Make sure the sheet is complete and the writing is sharp.');
});
$('rotate').onclick=()=>{const c=$('preview'),temp=document.createElement('canvas');temp.width=c.height;temp.height=c.width;const ctx=temp.getContext('2d');ctx.translate(temp.width,0);ctx.rotate(Math.PI/2);ctx.drawImage(c,0,0);c.width=temp.width;c.height=temp.height;c.getContext('2d').drawImage(temp,0,0);};
$('scan').onclick=guard(async()=>{
 saveJob();if(!image)throw Error('Add a photo first.');busy=true;for(const id of ['scan','rotate','photo','mode','manualAdd','newJob','restore'])$(id).disabled=true;say('Reading the photo with two independent scans; uncertain cells receive a third check…');
 try{const response=await fetch('/api/recognize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:image.toDataURL('image/jpeg',.92)}),signal:AbortSignal.timeout(210000)});const data=await response.json();if(!response.ok)throw Error(data.error||'Scan failed.');if(!data.entries.length)throw Error('No occupied cells found. Retake the photo or enter lengths manually.');current=data.entries.map(e=>({...e,mode:$('mode').value,confirmed:false}));renderReview();say(`${data.passes} scans completed. ${data.warnings.join(' ')}`);}finally{busy=false;for(const id of ['scan','rotate','photo','mode','manualAdd','newJob','restore'])$(id).disabled=false;}
});
$('manualAdd').onclick=guard(()=>{
 if(current.length&&!confirm('Replace the current unverified review?'))return;
 const values=$('manual').value.trim().split(/\s+/).filter(Boolean).map(Number);if(!values.length||values.some(v=>!Number.isFinite(v)||v<=0))throw Error('Enter positive lengths, one per line.');
 current=values.map((length,i)=>({position:i+1,length,mode:$('mode').value,needsReview:true,confirmed:false}));clearPhoto();renderReview();say('Check each manually entered length.');
});
$('addRow').onclick=()=>{current.push({position:Math.max(0,...current.map(e=>e.position))+1,length:null,mode:$('mode').value,needsReview:true,confirmed:false});renderReview();};
$('cancel').onclick=()=>{if(confirm('Discard this unverified batch?')){current=[];$('review').hidden=true;}};
$('accept').onclick=guard(()=>{
 if(!current.length)throw Error('Add entries before saving.');
 if(current.some(e=>!Number.isFinite(e.length)||e.length<=0||((e.needsReview||unusual(e.length,e.mode))&&!e.confirmed)))throw Error('Enter a positive length and confirm every uncertain or unusual entry.');
 saveJob();const next=structuredClone(job);next.batches.push({run:false,entries:current.map(e=>({position:e.position,length:e.length,mode:e.mode}))});validateJob(next);persist(next);current=[];$('review').hidden=true;$('photo').value='';$('preview').hidden=true;image=null;$('scan').disabled=true;$('rotate').disabled=true;renderTotals();say('Verified batch saved. Add the next sheet to continue numbering.');
});
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('copy').onclick=guard(async()=>{const text=allEntries().map(e=>$('format').value==='nodot'?e.length.toFixed(2).replace('.',''):e.length.toFixed(2)).join('\n');try{await navigator.clipboard.writeText(text);say('Lengths copied for Excel.');}catch{$('copyFallback').hidden=false;$('copyFallback').value=text;$('copyFallback').select();say('Select and copy the lengths below.');}});
$('csv').onclick=guard(()=>{const escape=v=>'"'+String(v).replaceAll('"','""')+'"';const rows=summarize(allEntries(),job.sections,job.start).rows;download('rig-tally.csv',['Entry,First joint,Last joint,Tubing size,Length ft',...rows.map((e,i)=>[i+1,e.first,e.last,e.size,e.length.toFixed(2)].map(escape).join(','))].join('\n'),'text/csv');});
$('backup').onclick=()=>download('rig-tally-job.json',JSON.stringify(job,null,2),'application/json');
$('restore').onchange=guard(async()=>{const file=$('restore').files[0];if(!file)return;const next=validateJob(JSON.parse(await file.text()));if(!confirm('Replace this device’s current job with the backup?'))return;persist(next);current=[];clearPhoto();$('review').hidden=true;populate();say('Job restored.');});
$('newJob').onclick=guard(()=>{if(!confirm('Start a new job? Download a backup first to keep the current job.'))return;persist({company:'',well:'',string:'',start:1,sections:[],batches:[]});current=[];clearPhoto();$('review').hidden=true;populate();say('New job ready.');});
populate();fetch('/api/status').then(r=>r.json()).then(s=>{if(!s.recognitionConfigured)say('Manual tally entry is ready. Photo recognition needs the server’s OpenAI API key configured.');}).catch(()=>say('Server unavailable. Saved job data is still on this device.'));
