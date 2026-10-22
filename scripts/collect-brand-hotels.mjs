import fs from 'node:fs/promises';
import {BRAND_CATALOG,matchBrand} from '../lib/brands.mjs';
import {discoverHotels,fetchHotel} from '../lib/official.mjs';
const path='data/official-snapshot.json',snapshot=JSON.parse(await fs.readFile(path,'utf8'));
const hotels=new Map(snapshot.hotels.map(h=>[h.id,{...h,brand:matchBrand(h.brand,h.name)?.name||h.brand}]));
const date=offset=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+offset*86400000));
const coverage=[];
for(const brand of BRAND_CATALOG){
 if(['国际品牌','存量品牌'].includes(brand.category))continue;
 try{const candidates=await discoverHotels('上海',brand.name);let added=0;const failures=[];
 for(const c of candidates.filter(h=>!hotels.has(h.id)).slice(0,3)){try{const h=await fetchHotel(c.id,date(1),date(2));if(h.brand===brand.name){hotels.set(h.id,h);added++;}}catch(e){failures.push({id:c.id,error:e.message});}}
 coverage.push({brand:brand.name,candidates:candidates.length,added,failures});console.log(brand.name,JSON.stringify({candidates:candidates.length,added}));
 }catch(e){coverage.push({brand:brand.name,error:e.message});console.log(brand.name,e.message);}
}
const collectedAt=new Date().toISOString();await fs.writeFile(path,JSON.stringify({...snapshot,hotels:[...hotels.values()],collectedAt,coverage:'华住全品类品牌目录；门店为部分上海官方候选，非全量'},null,2));
await fs.writeFile('data/brand-coverage.json',JSON.stringify({checkedAt:collectedAt,meaning:'候选为官方关键词本次返回值，不代表该品牌在上海的全部门店；0不表示无店',brands:coverage},null,2));console.log('TOTAL',hotels.size);
