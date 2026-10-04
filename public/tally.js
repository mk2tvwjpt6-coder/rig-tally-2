export function joints(length, mode='auto') { return mode==='stands'?2:mode==='singles'?1:length>40?2:1; }
export function summarize(entries, sections=[], start=1) {
 let next=start, cents=0;
 const rows=entries.map(e=>{
  if(!Number.isFinite(e.length)||e.length<=0) throw Error('Every entry needs a positive length.');
  const count=joints(e.length,e.mode), first=next; next+=count; cents+=Math.round(e.length*100);
  let boundary=0;
  const sizes=Array.from({length:count},(_,i)=>{
   boundary=0; const section=sections.find(s=>{boundary+=s.count;return first+i<=boundary;});
   return section?.size||'Unassigned';
  });
  if(new Set(sizes).size>1) throw Error(`Entry at joint ${first} crosses a tubing-size boundary. Enter the measured singles separately.`);
  return {...e,first,last:next-1,size:sizes[0]};
 });
 return {rows,feet:cents/100,joints:next-start,entries:rows.length};
}
export function unusual(length,mode) { const avg=length/joints(length,mode); return avg<27||avg>34; }
