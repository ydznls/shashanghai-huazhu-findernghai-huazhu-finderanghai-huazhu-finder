import {extractMetro,extractOpening} from './official.mjs';
import {matchBrand} from './brands.mjs';
export const PRICE_ORIGIN='https://hweb-hotel.huazhu.com';
const dayMs=86400000;
function requestedDays(checkIn,checkOut){const days=[];for(let t=Date.parse(checkIn+'T00:00:00Z'),end=Date.parse(checkOut+'T00:00:00Z');t<end&&days.length<31;t+=dayMs)days.push(new Date(t).toISOString().slice(0,10));return days;}
export function bookingUrl(id,checkIn,checkOut){return 'https://hrewards.huazhu.com/hotel/detail?'+new URLSearchParams({hotelId:id,checkInDate:checkIn,checkOutDate:checkOut});}
export async function readOfficialJson(path,params,{signal=AbortSignal.timeout(12000)}={}){
 if(!['/hotels/hotel/detail','/hotels/hotel/roomPrice'].includes(path))throw Error('不支持的官方查询入口');
 const url=new URL(path,PRICE_ORIGIN);url.search=new URLSearchParams(params);
 const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json, text/plain, */*','Referer':'https://hrewards.huazhu.com/','Origin':'https://hrewards.huazhu.com'},redirect:'manual',signal,cache:'no-store'});
 if(!response.ok)throw Error(`官方价格接口暂不可读（${response.status}）`);
 const result=await response.json();if(result.code!==200||String(result.businessCode)!=='1000'||!result.content)throw Error('官方没有返回有效查询结果');
 return result;
}
export function parseReferencePrices(payload,identity,hotel,checkIn,checkOut,observedAt=new Date().toISOString()){
 const detail=identity?.content;
 if(identity?.code!==200||String(identity.businessCode)!=='1000'||String(detail?.hotelId)!==hotel.id||detail.cityName!=='上海')throw Error('官方酒店身份或城市与查询不符');
 if(payload?.code!==200||String(payload.businessCode)!=='1000'||!Array.isArray(payload?.content?.roomList))throw Error('官方未返回可核验的房型列表');
 const expected=requestedDays(checkIn,checkOut);if(!expected.length||expected.length>30)throw Error('查询日期无效');
 const sourceUrl=PRICE_ORIGIN+'/hotels/hotel/roomPrice?'+new URLSearchParams({hotelId:hotel.id,checkInDate:checkIn,checkOutDate:checkOut,roomCount:'1',guestPerRoom:'1'});
 const rooms=[];
 for(const room of payload.content.roomList){
  // Read the dated original-price field of a base plan. Never reverse a member
  // discount or substitute discounted amount, activity, package or hourly rates.
  const plans=(room.ratePlanCodeList||[]).filter(p=>!p.activityId&&!p.isAgreement&&!p.PackageRate&&!p.packageOrderYn&&!p.packagesActivity&&!p.IsExchangeCertificate&&!p.isNightSnack&&!(Number(p.hourAge)>0));
  const candidates=[];
  for(const plan of plans){
   const raw=plan.dailyPrice;if(!Array.isArray(raw)||raw.length!==expected.length)continue;
   const byDate=new Map();let invalid=false;
   for(const d of raw){const date=typeof d.date==='string'?d.date.slice(0,10):'';const prices=(d.prices||[]).filter(p=>p.currencyCode==='CNY');
    if(!expected.includes(date)||byDate.has(date)||prices.length!==1||typeof prices[0].marketPrice!=='number'||!Number.isFinite(prices[0].marketPrice)||prices[0].marketPrice<=0){invalid=true;break;}
    byDate.set(date,Math.round(prices[0].marketPrice*100));
   }
   if(invalid||byDate.size!==expected.length)continue;
   const daily=expected.map(date=>({date,amount:byDate.get(date)/100})),totalCents=[...byDate.values()].reduce((a,b)=>a+b,0);
   const available=room.fullyBooked===true||plan.fullyBooked===true||room.isRoomOpenResv===false||plan.isRatePlanOpenResv===false||Number(plan.roomCount)===0?'unavailable':room.bookingAvailable===true&&Number(plan.roomCount)>0?'available':'unknown';
   candidates.push({kind:'official_reference',currency:'CNY',amount:Math.round(totalCents/expected.length)/100,total:totalCents/100,nights:expected.length,checkIn,checkOut,roomId:String(room.guestRoomCode||''),roomName:String(room.typeRoomName||'房型名称待补充'),bed:room.bedWidthNewDesc||room.bedTypeName||null,area:room.roomArea||null,window:room.isHasWindowNewDesc||room.hasWindow||null,daily,availability:available,observedAt,sourceUrl,bookingUrl:bookingUrl(hotel.id,checkIn,checkOut),field:'dailyPrice.prices[CNY].marketPrice',taxNote:'税费及最终预订价格以官网为准'});
  }
  candidates.sort((a,b)=>(a.availability==='unavailable')-(b.availability==='unavailable')||a.total-b.total);
  if(candidates[0])rooms.push(candidates[0]);
 }
 rooms.sort((a,b)=>(a.availability==='unavailable')-(b.availability==='unavailable')||a.total-b.total);
 const quote=rooms.find(r=>r.availability!=='unavailable')||null;
 return {quote,rooms,observedAt,sourceUrl,dateConfirmed:rooms.length>0,status:quote?'reference_price':rooms.length?'no_available_reference':'no_public_quote',message:quote?'已取得与入住日期逐日对应的官网划线参考价；黄金8.8折、铂金8.5折仅为换算估算。':rooms.length?'官网返回的参考价对应房型暂不可订，请以官网为准。':'官网本次未返回可核验的逐日划线参考价。'};
}
export async function queryOfficialPrices(hotel,checkIn,checkOut,{readJson=readOfficialJson,signal:parentSignal}={}){
 const began=Date.now(),timeout=AbortSignal.timeout(12000),signal=parentSignal?AbortSignal.any([parentSignal,timeout]):timeout,params={hotelId:hotel.id,checkInDate:checkIn,checkOutDate:checkOut,roomCount:'1',guestPerRoom:'1'};
 const [identity,payload]=await Promise.all([readJson('/hotels/hotel/detail',params,{signal}),readJson('/hotels/hotel/roomPrice',params,{signal})]);
 const rates=parseReferencePrices(payload,identity,hotel,checkIn,checkOut),d=identity.content,score=d.hotelScores;
 const description=typeof d.description==='string'?d.description:hotel.description||'',address=d.hotelAddress||hotel.address||'';
 const current={...hotel,name:d.hotelName||hotel.name,brand:matchBrand('',d.hotelName)?.name||hotel.brand,address,description,score:score?.commentCount>0&&Number.isFinite(score.experienceValueShow)&&score.experienceValueShow>=0&&score.experienceValueShow<=5?score.experienceValueShow:hotel.score,reviewCount:score?.commentCount??hotel.reviewCount,metro:extractMetro(address+' '+description)||hotel.metro,opening:extractOpening(description)||hotel.opening,checkIn,checkOut,priceCheckedAt:rates.observedAt,quote:rates.quote,roomQuotes:rates.rooms,quoteStatus:rates.message};
 return {id:hotel.id,name:current.name,checkIn,checkOut,sourceUrl:bookingUrl(hotel.id,checkIn,checkOut),checkedAt:rates.observedAt,elapsedMs:Date.now()-began,quote:rates.quote,status:rates.status,message:rates.message,dateConfirmed:rates.dateConfirmed,hotel:current,roomTypes:rates.rooms.map(r=>({name:r.roomName,bed:r.bed,area:r.area,quote:r}))};
}
