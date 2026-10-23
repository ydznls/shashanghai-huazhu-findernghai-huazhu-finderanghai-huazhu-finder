import fs from 'node:fs/promises';
import {readOfficialJson,PRICE_ORIGIN} from '../lib/official-prices.mjs';
import {openingFromBusinessDate} from '../lib/opening.mjs';
import {validateDates} from '../lib/official.mjs';
const snapshot=JSON.parse(await fs.readFile('data/official-snapshot.json','utf8'));
const date=offset=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+offset*86400000));
const {checkIn,checkOut}=validateDates(process.argv[2]||date(1),process.argv[3]||date(2));
const checkpoint='.sites-runtime/opening-checkpoint.json',rows={};
try{const old=JSON.parse(await fs.readFile(checkpoint,'utf8'));for(const h of snapshot.hotels){const r=old.hotels?.[h.id];if(r&&r.name===h.name&&r.status!=='error')rows[h.id]=r;}}catch{}
await fs.mkdir('.sites-runtime',{recursive:true});
const pending=snapshot.hotels.filter(h=>!rows[h.id]);let cursor=0,done=Object.keys(rows).length,halt=false;
const payload=()=>({collectedAt:new Date().toISOString(),source:'华住官方酒店详情',field:'businessDate',hotels:rows});
async function worker(){for(;;){if(halt)return;const h=pending[cursor++];if(!h)return;const params={hotelId:h.id,checkInDate:checkIn,checkOutDate:checkOut,roomCount:'1',guestPerRoom:'1'},sourceUrl=PRICE_ORIGIN+'/hotels/hotel/detail?'+new URLSearchParams(params),checkedAt=new Date().toISOString();
 try{const j=await readOfficialJson('/hotels/hotel/detail',params);const d=j.content;if(String(d.hotelId)!==h.id||d.cityName!=='上海')throw Error('官方酒店身份或城市不符');const opening=openingFromBusinessDate(d.businessDate,{sourceUrl,checkedAt});rows[h.id]={id:h.id,name:h.name,officialName:d.hotelName,opening,raw:d.businessDate??null,status:opening?'verified':d.businessDate?'invalid':'missing',sourceUrl,checkedAt};}
 catch(e){rows[h.id]={id:h.id,name:h.name,status:'error',message:e.message,sourceUrl,checkedAt};if(/429|418|403/.test(e.message))halt=true;}
 done++;if(done%30===0||done===snapshot.hotels.length){console.log(JSON.stringify({done,total:snapshot.hotels.length,verified:Object.values(rows).filter(r=>r.opening).length,errors:Object.values(rows).filter(r=>r.status==='error').length}));}
 await new Promise(r=>setTimeout(r,1000));
}}
let checkpointWrite=Promise.resolve();
const timer=setInterval(()=>{const content=JSON.stringify(payload());checkpointWrite=checkpointWrite.then(()=>fs.writeFile(checkpoint,content)).catch(e=>console.warn('Checkpoint write failed:',e.message));},10000);
try{await Promise.all([worker(),worker()]);}finally{clearInterval(timer);}
await checkpointWrite;
await fs.writeFile(checkpoint,JSON.stringify(payload()));
await fs.writeFile('data/official-opening.next.json',JSON.stringify(payload(),null,2));await fs.rename('data/official-opening.next.json','data/official-opening.json');
let added=0;for(const h of snapshot.hotels){const r=rows[h.id];if(r?.opening){if(!h.opening)added++;h.opening=r.opening;}}
snapshot.openingCollectedAt=new Date().toISOString();
await fs.writeFile('data/official-snapshot.next.json',JSON.stringify(snapshot,null,2));await fs.rename('data/official-snapshot.next.json','data/official-snapshot.json');
console.log(JSON.stringify({complete:!halt&&done===snapshot.hotels.length,done,total:snapshot.hotels.length,added,verified:Object.values(rows).filter(r=>r.opening).length,missing:Object.values(rows).filter(r=>r.status==='missing').length,invalid:Object.values(rows).filter(r=>r.status==='invalid').length,errors:Object.values(rows).filter(r=>r.status==='error').length,halt}));
