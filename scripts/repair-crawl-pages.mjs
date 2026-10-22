import fs from 'node:fs/promises';
import {createShanghaiListSession,parseHotelList} from '../lib/official-list.mjs';
import {fetchHotel} from '../lib/official.mjs';
const root='../shanghai-crawl',base=JSON.parse(await fs.readFile(root+'/list-result.json','utf8'));
const {checkIn,checkOut}=base,get=await createShanghaiListSession(checkIn,checkOut),pause=ms=>new Promise(r=>setTimeout(r,ms)),failed=[];
await get(1); // Initialize the list state before following the site's More links.
for(const p of base.pages.filter(p=>!p.ids.length&&!p.excluded)){
 let repaired=false;for(let attempt=0;attempt<3;attempt++){try{const r=await get(p.page);if(!r.reportedTotal||(!r.rows.length&&!r.excluded.length))throw new Error('空页');await fs.writeFile(`${root}/page-${p.page}.html`,r.html);console.log('Repaired',p.page,r.rows.length);repaired=true;break;}catch(e){await pause(2000);}}
 if(!repaired)failed.push(p.page);await pause(300);
}
const rows=new Map(),excluded=[],pages=[];
for(let page=1;page<=base.totalPages;page++){const s=await fs.readFile(`${root}/page-${page}.html`,'utf8'),r=parseHotelList(s,{checkIn,checkOut,page});if(!r.reportedTotal)continue;for(const h of r.rows)rows.set(h.id,h);excluded.push(...r.excluded);pages.push({page,ids:r.rows.map(h=>h.id),excluded:r.excluded.length});}
const known=new Set(base.hotels.map(h=>h.id)),extra=[...rows.values()].filter(h=>!known.has(h.id)),errors=[];let index=0,done=0;
async function worker(){for(;;){const i=index++;if(i>=extra.length)return;const h=extra[i];try{extra[i]={...await fetchHotel(h.id,checkIn,checkOut),listEvidence:h.listEvidence,detailStatus:'verified'};}catch(e){extra[i]={...h,detailError:e.message};errors.push({stage:'detail',id:h.id,error:e.message});}done++;if(done%30===0)console.log('Extra details',done,extra.length);await pause(300);}}
await Promise.all([worker(),worker()]);
await fs.writeFile(`${root}/repair-result.json`,JSON.stringify({pages,excluded,failed,extra,errors},null,2));console.log(JSON.stringify({repairedComplete:true,pages:pages.length,total:rows.size,extras:extra.length,failed}));
