import fs from 'node:fs/promises';
import {queryPublicHotel} from '../lib/realtime.mjs';
const s=JSON.parse(await fs.readFile('data/official-snapshot.json','utf8'));
const date=offset=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+offset*86400000));
const chosen=['全季','汉庭','诺富特'].map(brand=>s.hotels.find(h=>h.brand===brand&&(brand==='诺富特'||h.detailStatus==='verified'))).filter(Boolean),results=[];
for(const h of chosen){const r=await queryPublicHotel(h,date(1),date(2));results.push({id:r.id,name:r.name,sourceUrl:r.sourceUrl,checkIn:r.checkIn,checkOut:r.checkOut,checkedAt:r.checkedAt,status:r.status,dateConfirmed:r.dateConfirmed,roomTypeCount:r.roomTypes.length,quote:r.quote,elapsedMs:r.elapsedMs});console.log(JSON.stringify(results.at(-1)));}
await fs.writeFile('data/public-connection-evidence.json',JSON.stringify({testedAt:new Date().toISOString(),meaning:'真实官网公开页面查询结果；未返回报价不代表满房',memberCalendar:'官网脚本/Hotel/Price属于华住会员价，不用作官方公开价',results},null,2));
