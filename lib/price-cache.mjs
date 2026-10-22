import {activeQuote} from './price-utils.mjs';
const KEY='hz-price-cache-v1',MAX_CHARS=1800000,MAX_AGE=48*60*60*1000;
const key=(id,a,b)=>`${id}|${a}|${b}`;
export function priceStorage(){try{return globalThis.localStorage}catch{return null}}
function validQuote(q,a,b){
 if(!activeQuote(q,a,b)||!Array.isArray(q.daily)||!q.daily.length||typeof q.roomName!=='string'||typeof q.roomId!=='string')return false;
 if(!q.daily.every(d=>d&&typeof d.date==='string'&&Number.isFinite(d.amount)&&d.amount>0)||!Number.isFinite(q.total)||q.total<=0)return false;
 try{return new URL(q.sourceUrl).origin==='https://hweb-hotel.huazhu.com'&&new URL(q.bookingUrl).origin==='https://hrewards.huazhu.com'}catch{return false}
}
function read(storage,now){
 try{
  const raw=storage.getItem(KEY);if(!raw||raw.length>MAX_CHARS)return [];
  const entries=JSON.parse(raw);if(!Array.isArray(entries))return [];
  return entries.filter(e=>e&&typeof e.id==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(e.checkIn)&&/^\d{4}-\d{2}-\d{2}$/.test(e.checkOut)&&Number.isFinite(Date.parse(e.checkedAt))&&now-Date.parse(e.checkedAt)<MAX_AGE&&Date.parse(e.checkedAt)<=now+60000&&(e.quote===null||validQuote(e.quote,e.checkIn,e.checkOut))&&Array.isArray(e.rooms)&&e.rooms.every(q=>validQuote(q,e.checkIn,e.checkOut)));
 }catch{return []}
}
export function saveCachedPrices(storage,hotels,now=Date.now()){
 try{
  const entries=new Map(read(storage,now).map(e=>[key(e.id,e.checkIn,e.checkOut),e]));
  for(const h of hotels){
   const a=h.quote?.checkIn||h.checkIn,b=h.quote?.checkOut||h.checkOut;
   if(!a||!b||h.quote===undefined)continue;
   if(h.quote!==null&&!validQuote(h.quote,a,b))continue;
   const checkedAt=h.priceCheckedAt||h.quote?.observedAt||new Date(now).toISOString();
   const entry={id:h.id,checkIn:a,checkOut:b,checkedAt,quote:h.quote,rooms:(h.roomQuotes||[]).filter(q=>validQuote(q,a,b)).slice(0,3),message:h.quoteStatus||''};
   entries.set(key(h.id,a,b),entry);
  }
  const recent=[...entries.values()].sort((a,b)=>Date.parse(b.checkedAt)-Date.parse(a.checkedAt));
  const kept=[];let size=2;
  for(const entry of recent){const length=JSON.stringify(entry).length+1;if(size+length<=MAX_CHARS){kept.push(entry);size+=length}}
  storage.setItem(KEY,JSON.stringify(kept));return true;
 }catch{return false}
}
export function restoreCachedPrices(storage,hotels,checkIn,checkOut,now=Date.now()){
 const entries=new Map(read(storage,now).filter(e=>e.checkIn===checkIn&&e.checkOut===checkOut).map(e=>[e.id,e]));
 return hotels.map(h=>{
  const e=entries.get(h.id);if(!e)return h;
  const current=activeQuote(h.quote,checkIn,checkOut),stamp=current?.observedAt||(h.checkIn===checkIn&&h.checkOut===checkOut?h.priceCheckedAt:null);
  if(stamp&&Date.parse(stamp)>Date.parse(e.checkedAt))return h;
  return {...h,checkIn,checkOut,quote:e.quote,roomQuotes:e.rooms,quoteStatus:e.message,priceCheckedAt:e.checkedAt};
 });
}
