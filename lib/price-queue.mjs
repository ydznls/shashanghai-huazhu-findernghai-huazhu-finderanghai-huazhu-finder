export const PRICE_BATCH_SIZE=6;
export const PRICE_PREVIEW_COUNT=30;
export const isPriceFailure=result=>['timeout','unavailable','login_required','verification_required'].includes(result.status);

// Bound each request while allowing one user action to cover the full list.
export async function runPriceQueue({hotels,checkIn,checkOut,signal,onBatch,fetcher=fetch,delayMs=350}){
 let completed=0,consecutiveFailures=0;
 for(let offset=0;offset<hotels.length;offset+=PRICE_BATCH_SIZE){
  if(signal.aborted)return {completed,paused:true};
  const batch=hotels.slice(offset,offset+PRICE_BATCH_SIZE),ids=batch.map(h=>h.id);
  let results;
  try{
   const response=await fetcher('/api/realtime',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids,checkIn,checkOut}),signal:AbortSignal.any([signal,AbortSignal.timeout(45000)]),cache:'no-store'});
   if(signal.aborted)return {completed,paused:true};
   if(!response.ok){
    const data=await response.json().catch(()=>({}));
    const error=new Error(data.error||`查询暂时失败（${response.status}）`);
    if([400,401,403,418,429,503].includes(response.status))error.stopQueue=true;
    throw error;
   }
   const data=await response.json();
   if(data.checkIn!==checkIn||data.checkOut!==checkOut||!Array.isArray(data.results)||data.results.length!==ids.length||new Set(data.results.map(r=>r?.id)).size!==ids.length||data.results.some(r=>!r||!ids.includes(r.id)||r.checkIn!==checkIn||r.checkOut!==checkOut||typeof r.status!=='string'||(r.hotel&&(r.hotel.id!==r.id||r.hotel.checkIn!==checkIn||r.hotel.checkOut!==checkOut)))){
    const error=new Error('查询日期或门店与返回结果不一致，已暂停更新。');error.stopQueue=true;throw error;
   }
   results=data.results;
  }catch(error){
   if(signal.aborted)return {completed,paused:true};
   if(error.stopQueue)throw error;
   results=batch.map(h=>({id:h.id,name:h.name,checkIn,checkOut,sourceUrl:h.sourceUrl,checkedAt:new Date().toISOString(),status:'unavailable',message:error.message||'本批连接失败，可以重试。',hotel:null,roomTypes:[],dateConfirmed:false}));
  }
  if(signal.aborted)return {completed,paused:true};
  completed+=results.length;onBatch(results);
  consecutiveFailures=results.every(isPriceFailure)?consecutiveFailures+1:0;
  if(consecutiveFailures>=3)throw new Error('连续三批连接失败，已自动暂停。已取得的价格保留，可稍后继续或重试失败项。');
  if(offset+PRICE_BATCH_SIZE<hotels.length&&delayMs>0){
   await new Promise(resolve=>{const done=()=>{clearTimeout(timer);signal.removeEventListener('abort',done);resolve()};const timer=setTimeout(done,delayMs);signal.addEventListener('abort',done,{once:true});if(signal.aborted)done()});
  }
 }
 return {completed,paused:false};
}
