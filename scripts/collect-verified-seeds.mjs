import fs from 'node:fs/promises';
import {fetchHotel} from '../lib/official.mjs';
// Official detail URLs found in the official site's indexed Shanghai pages.
const ids=['9001257','9000825','9003239','9001029','9011077','9008118','8000604'];
const path='data/official-snapshot.json',snapshot=JSON.parse(await fs.readFile(path,'utf8'));
const hotels=new Map(snapshot.hotels.map(h=>[h.id,h]));
const date=offset=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+offset*86400000));
for(const id of ids){try{const h=await fetchHotel(id,date(1),date(2));hotels.set(h.id,h);console.log(h.id,h.brand,h.name);}catch(e){console.log(id,e.message);}}
await fs.writeFile(path,JSON.stringify({...snapshot,hotels:[...hotels.values()],collectedAt:new Date().toISOString()},null,2));
console.log('TOTAL',hotels.size);
