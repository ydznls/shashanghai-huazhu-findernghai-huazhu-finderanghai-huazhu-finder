import fs from 'node:fs/promises';
import {discoverHotels,fetchHotel} from '../lib/official.mjs';
const ids=new Set(['9001100','8000395','9000923','2012101','2018001','2018051']);
for(const q of ['上海','汉庭上海','漫心上海','全季上海']) {
 try{for(const h of (await discoverHotels(q)).slice(0,q==='上海'?30:5))ids.add(h.id);}catch(e){console.error(q,e.message);}
}
const hotels=[],errors=[];for(const id of ids){try{const h=await fetchHotel(id,'2026-10-21','2026-10-22');hotels.push(h);console.log(h.id,h.name,JSON.stringify({metro:h.metro?.meters,opening:h.opening?.year,score:h.score,rooms:h.roomCount}));}catch(e){errors.push({id,error:e.message});}}
await fs.mkdir('data',{recursive:true});await fs.writeFile('data/official-snapshot.json',JSON.stringify({hotels,errors,collectedAt:new Date().toISOString(),coverage:'部分上海华住门店，非全量'},null,2));console.log('Collected',hotels.length,'errors',errors.length);
