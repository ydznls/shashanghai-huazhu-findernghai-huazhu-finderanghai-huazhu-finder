import fs from 'node:fs/promises';
import {openingFromBusinessDate} from '../lib/opening.mjs';
import {validateDates} from '../lib/official.mjs';
import {readOfficialJson,PRICE_ORIGIN} from '../lib/official-prices.mjs';
const snapshot=JSON.parse(await fs.readFile('data/official-snapshot.json','utf8'));
const known=new Map(snapshot.hotels.map(h=>[h.id,h]));
const date=n=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+n*86400000));
const {checkIn,checkOut}=validateDates(process.argv[2]||date(1),process.argv[3]||date(2));
const pagesPath='.sites-runtime/opening-list-pages.json',checkpoint='.sites-runtime/opening-checkpoint.json';
let pages={},rows={};
try{const d=JSON.parse(await fs.readFile(pagesPath,'utf8'));if(d.checkIn===checkIn&&d.checkOut===checkOut)pages=d.pages||{};}catch{}
try{rows=JSON.parse(await fs.readFile(checkpoint,'utf8')).hotels||{};}catch{}
let total=0,halt=false;
for(let page=1;page<=Math.max(1,Math.ceil(total/20));page++){
 let entry=pages[page];
 if(!entry){
  const u=new URL('https://hweb-hotel.huazhu.com/hotels/hotel/list');
  u.search=new URLSearchParams({checkInDate:checkIn,checkOutDate:checkOut,cityName:'上海',sortBy:'0',pageSize:'20',pageIndex:String(page),keyword:''});
  const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json, text/plain, */*','Referer':'https://hrewards.huazhu.com/','Origin':'https://hrewards.huazhu.com'},redirect:'manual',signal:AbortSignal.timeout(25000)});
  if(!r.ok){console.log(JSON.stringify({page,http:r.status,halt:true}));halt=true;break;}
  const j=await r.json(),content=j.content;
  if(j.code!==200||String(j.businessCode)!=='1000'||!Array.isArray(content?.hotelList))throw Error('官方没有返回有效酒店列表');
  const reported=Number(content.totalCount);if(!Number.isInteger(reported)||reported<1||reported>3000)throw Error('官方列表总数异常');
  if(content.hotelList.length>20||content.hotelList.some(h=>!h.hotelId||h.cityName!=='上海'))throw Error('酒店列表身份或城市异常');
  if(!content.hotelList.length&&page<=Math.ceil(reported/20))throw Error('官方列表提前返回空页');
  const ids=new Set(Object.values(pages).flatMap(p=>p.hotels.map(h=>h.id)));
  if(content.hotelList.some(h=>ids.has(String(h.hotelId))))throw Error('官方分页返回重复酒店，停止以免遗漏');
  entry={page,total:reported,sourceUrl:u.href,checkedAt:new Date().toISOString(),hotels:content.hotelList.map(h=>({id:String(h.hotelId),name:h.hotelName,city:h.cityName,businessDate:h.businessDate??null}))};
  pages[page]=entry;
  await fs.writeFile(pagesPath,JSON.stringify({checkIn,checkOut,pages}));
 }
 total=entry.total;
 for(const item of entry.hotels){
  const hotel=known.get(item.id);if(!hotel)continue;
  const opening=openingFromBusinessDate(item.businessDate,{sourceUrl:entry.sourceUrl,checkedAt:entry.checkedAt});
  if(opening||!rows[item.id]?.opening)rows[item.id]={id:item.id,name:hotel.name,officialName:item.name,opening,raw:item.businessDate,status:opening?'verified':item.businessDate?'invalid':'missing',sourceKind:'list',pageIndex:entry.page,sourceUrl:entry.sourceUrl,checkedAt:entry.checkedAt};
 }
 await fs.writeFile(checkpoint,JSON.stringify({collectedAt:new Date().toISOString(),field:'businessDate',hotels:rows}));
 console.log(JSON.stringify({page,pages:Math.ceil(total/20),read:Object.values(pages).reduce((n,p)=>n+p.hotels.length,0),verified:Object.values(rows).filter(h=>h.opening).length}));
 await new Promise(r=>setTimeout(r,1800));
}
// The list can omit a known property or its date. Query only those remaining
// IDs through the detail endpoint, and retain genuinely empty dates as missing.
if(!halt)for(const hotel of snapshot.hotels.filter(h=>!rows[h.id]?.opening)){
 const params={hotelId:hotel.id,checkInDate:checkIn,checkOutDate:checkOut,roomCount:'1',guestPerRoom:'1'},sourceUrl=PRICE_ORIGIN+'/hotels/hotel/detail?'+new URLSearchParams(params),checkedAt=new Date().toISOString();
 try{
  const j=await readOfficialJson('/hotels/hotel/detail',params),d=j.content;
  if(String(d.hotelId)!==hotel.id||d.cityName!=='上海')throw Error('酒店详情身份或城市异常');
  const opening=openingFromBusinessDate(d.businessDate,{sourceUrl,checkedAt});
  rows[hotel.id]={id:hotel.id,name:hotel.name,officialName:d.hotelName,opening,raw:d.businessDate??null,status:opening?'verified':d.businessDate?'invalid':'missing',sourceUrl,checkedAt};
 }catch(e){rows[hotel.id]={id:hotel.id,name:hotel.name,status:'error',message:e.message,sourceUrl,checkedAt};if(/429|418|403/.test(e.message)){halt=true;break;}}
 await new Promise(r=>setTimeout(r,1800));
}
const collectedAt=new Date().toISOString();
const audit={collectedAt,source:'华住官方酒店列表与详情',field:'businessDate',list:{readPages:Object.keys(pages).length,totalPages:Math.ceil(total/20),reportedTotal:total,halt},hotels:rows};
await fs.writeFile('data/official-opening.next.json',JSON.stringify(audit,null,2));await fs.rename('data/official-opening.next.json','data/official-opening.json');
for(const hotel of snapshot.hotels){const row=rows[hotel.id];if(row?.opening)hotel.opening=row.opening;}
snapshot.openingCollectedAt=collectedAt;
await fs.writeFile('data/official-snapshot.next.json',JSON.stringify(snapshot,null,2));await fs.rename('data/official-snapshot.next.json','data/official-snapshot.json');
console.log(JSON.stringify({complete:!halt,total:snapshot.hotels.length,verified:snapshot.hotels.filter(h=>h.opening).length,unverified:snapshot.hotels.filter(h=>!h.opening).map(h=>({id:h.id,name:h.name})),list:audit.list}));
