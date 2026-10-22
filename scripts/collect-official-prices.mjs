import fs from 'node:fs/promises';
import {queryOfficialPrices} from '../lib/official-prices.mjs';
import {validateDates} from '../lib/official.mjs';
const snapshot=JSON.parse(await fs.readFile('data/official-snapshot.json','utf8'));
const date=offset=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+offset*86400000));
const {checkIn,checkOut}=validateDates(process.argv[2]||date(1),process.argv[3]||date(2)),hotels={},errors=[];let cursor=0,done=0,priced=0;
const payload=()=>JSON.stringify({checkIn,checkOut,collectedAt:new Date().toISOString(),priceKind:'官网划线参考价',memberEstimates:'黄金8.8折、铂金8.5折仅按用户给定折扣换算，并非实际会员报价',hotels,errors},null,2);
await fs.mkdir('.sites-runtime',{recursive:true});
async function worker(){for(;;){const i=cursor++;if(i>=snapshot.hotels.length)return;const h=snapshot.hotels[i];try{const r=await queryOfficialPrices(h,checkIn,checkOut);hotels[h.id]={quote:r.quote,rooms:r.hotel.roomQuotes.slice(0,3),roomCount:r.hotel.roomQuotes.length,message:r.message,checkedAt:r.checkedAt};if(r.quote)priced++;}catch(e){errors.push({id:h.id,error:e.name==='TimeoutError'?'官方查询超时':e.message});}done++;if(done%50===0||done===snapshot.hotels.length){await fs.writeFile('.sites-runtime/prices-checkpoint.json',payload());console.log(JSON.stringify({done,total:snapshot.hotels.length,priced,errors:errors.length}));}await new Promise(r=>setTimeout(r,200));}}
await Promise.all([worker(),worker(),worker()]);
await fs.writeFile('data/official-prices.next.json',payload());await fs.rename('data/official-prices.next.json','data/official-prices.json');
console.log(JSON.stringify({complete:true,priced,queried:done,errors:errors.length,checkIn,checkOut}));
