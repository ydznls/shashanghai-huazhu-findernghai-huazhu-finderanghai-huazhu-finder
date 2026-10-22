import fs from 'node:fs/promises';
import {createShanghaiListSession} from '../lib/official-list.mjs';
import {fetchHotel} from '../lib/official.mjs';
const root='../shanghai-crawl';await fs.mkdir(root,{recursive:true});
const date=offset=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+offset*86400000));
const checkIn=date(1),checkOut=date(2),pause=ms=>new Promise(r=>setTimeout(r,ms));
const get=await createShanghaiListSession(checkIn,checkOut),rows=new Map(),excluded=[],pages=[],failures=[];
let totalPages=1,reportedTotal=0;
for(let page=1;page<=totalPages;page++){
 let result;for(let attempt=0;attempt<3;attempt++){try{const response=await get(page);if(!response.reportedTotal||(!response.rows.length&&!response.excluded.length))throw new Error('官方分页暂时返回空结果');result=response;break;}catch(e){if(attempt===2)failures.push({stage:'list',page,error:e.message});else await pause(2000);}}
 if(!result){console.log('FAILED PAGE',page);continue;}
 if(page===1){totalPages=result.totalPages;reportedTotal=result.reportedTotal;if(!totalPages)throw new Error('官方上海列表未返回分页，停止，保留现有数据');}
 await fs.writeFile(`${root}/page-${page}.html`,result.html);
 const ids=result.rows.map(h=>h.id);if(ids.length&&pages.some(p=>p.ids.join(',')===ids.join(',')))throw new Error(`第${page}页与先前页面重复，停止以免误报完整覆盖`);
 pages.push({page,ids,excluded:result.excluded.length});for(const h of result.rows)rows.set(h.id,h);excluded.push(...result.excluded);
 if(page%10===0||page===totalPages)console.log(JSON.stringify({stage:'list',page,totalPages,unique:rows.size,excluded:excluded.length}));
 await pause(150);
}
await fs.writeFile(`${root}/list-result.json`,JSON.stringify({checkIn,checkOut,reportedTotal,totalPages,pages,excluded,failures,hotels:[...rows.values()]},null,2));
if(process.argv.includes('--list-only'))process.exit(0);
const old=JSON.parse(await fs.readFile('data/official-snapshot.json','utf8'));
const existing=new Map(old.hotels.map(h=>[h.id,h]));
const hotels=[...rows.values()].map(h=>{const prior=existing.get(h.id);return prior?{...h,...prior,listEvidence:h.listEvidence,detailStatus:'verified'}:h;});
let cursor=0,done=0,details=0;
async function save(){await fs.writeFile('data/official-snapshot.json',JSON.stringify({hotels,errors:failures,collectedAt:new Date().toISOString(),coverage:'已逐页读取官方上海列表；列表不等于当前营业、可订或官方全量门店',crawl:{reportedTotal,totalPages,readPages:pages.length,listRecords:rows.size,excluded:excluded.length,detailsFetched:details,checkIn,checkOut}},null,2));}
async function worker(){for(;;){const index=cursor++;if(index>=hotels.length)return;const h=hotels[index];
 try{const detail=await fetchHotel(h.id,checkIn,checkOut);hotels[index]={...detail,listEvidence:h.listEvidence,detailStatus:'verified'};details++;}
 catch(e){hotels[index]={...h,detailError:e.message};failures.push({stage:'detail',id:h.id,error:e.message});}
 done++;if(done%40===0||done===hotels.length){await save();console.log(JSON.stringify({stage:'detail',done,total:hotels.length,details,failed:failures.length}));}await pause(250);
}}
await Promise.all([worker(),worker()]);await save();
await fs.writeFile('data/crawl-audit.json',JSON.stringify({completedAt:new Date().toISOString(),source:'https://m.huazhu.com/city/shanghai?cityId=3101',checkIn,checkOut,reportedTotal,totalPages,readPages:pages.length,uniqueHotels:hotels.length,detailsFetched:details,pages,excluded,failures},null,2));
console.log(JSON.stringify({complete:true,hotels:hotels.length,details,brands:[...new Set(hotels.map(h=>h.brand))].length}));
