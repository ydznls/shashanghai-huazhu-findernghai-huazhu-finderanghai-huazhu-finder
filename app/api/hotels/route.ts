import snapshot from '../../../data/official-snapshot.json';
import priceSnapshot from '../../../data/official-prices.json';
import {discoverHotels,fetchHotel,validateDates} from '../../../lib/official.mjs';
import {BRAND_CATALOG,getBrand,matchBrand} from '../../../lib/brands.mjs';
export async function GET(request:Request){
 const p=new URL(request.url).searchParams;
 if(p.get('mode')!=='live')return Response.json({...snapshot,hotels:snapshot.hotels.map(h=>{const rates=(priceSnapshot.hotels as Record<string,{quote:unknown,rooms:unknown[],message:string,checkedAt:string}>)[h.id];return {...h,brand:matchBrand(h.brand,h.name)?.name||h.brand,...(rates?{quote:rates.quote,roomQuotes:rates.rooms,quoteStatus:rates.message,priceCheckedAt:rates.checkedAt,checkIn:priceSnapshot.checkIn,checkOut:priceSnapshot.checkOut}:{})}}),brands:BRAND_CATALOG,priceCollectedAt:priceSnapshot.collectedAt,mode:'snapshot'},{headers:{'Cache-Control':'no-store'}});
 const requested=p.get('brand')||'',brand=requested?getBrand(requested):null;
 if(requested&&!brand)return Response.json({error:'请选择官方品牌目录中的品牌'},{status:400});
 try{
  const {checkIn,checkOut}=validateDates(p.get('checkIn')||'',p.get('checkOut')||'');
  const page=Math.max(0,Math.min(200,Math.floor(Number(p.get('page'))||0))),found=await discoverHotels('上海',brand?.name||'');
  const candidates=[...new Map([...found,...snapshot.hotels.filter(h=>!brand||matchBrand(h.brand,h.name)?.name===brand.name).map(h=>({id:h.id,name:h.name}))].map(h=>[h.id,h])).values()],hotels=[],errors=[];
  for(const c of candidates.slice(page*6,page*6+6)){try{const h=await fetchHotel(c.id,checkIn,checkOut);if(!brand||h.brand===brand.name)hotels.push({...h,opening:snapshot.hotels.find(s=>s.id===h.id)?.opening||h.opening||null});}catch(e){errors.push({id:c.id,error:e instanceof Error?e.message:'读取失败'});}}
  return Response.json({hotels,errors,collectedAt:new Date().toISOString(),mode:'live',brand:brand?.name||null,totalCandidates:candidates.length,nextPage:(page+1)*6<candidates.length?page+1:null},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'官方页面暂时无法读取'},{status:502});}
}
