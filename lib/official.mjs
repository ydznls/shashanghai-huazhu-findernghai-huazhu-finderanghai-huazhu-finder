import {BRAND_CATALOG,getBrand,matchBrand} from './brands.mjs';
import {activeQuote} from './price-utils.mjs';
export const BRANDS = BRAND_CATALOG.map(b=>b.name);
export const ORIGIN = 'https://m.huazhu.com';
const safeNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
export function decodeText(value='') { return String(value).replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim(); }
export function extractModel(html) {
 const m=html.match(/ndoo\.vars\.detailModel\s*=\s*("(?:\\.|[^"\\])*")/);
 if(!m)throw new Error('官方页面没有返回可解析的酒店详情');
 const model=JSON.parse(JSON.parse(m[1]));
 if(!model?.Info?.HotelCode)throw new Error('官方详情缺少酒店标识');
 return model;
}
export function extractOpening(text) {
 // Only an explicit property opening statement; founding year and renovation are different facts.
 const clean=decodeText(text);
 const m=clean.match(/((?:19|20)\d{2})年(?:(\d{1,2})月)?(?:\d{1,2}日)?(?:正式)?(?:开业|开张)/)||clean.match(/(?:开业时间|开业日期|开业于)\s*[:：]?\s*((?:19|20)\d{2})(?:[年\-/](\d{1,2}))?/);
 return m?{year:Number(m[1]),month:m[2]?Number(m[2]):null,evidence:m[0]}:null;
}
export function extractMetro(text) {
 const clean=decodeText(text);
 const patterns=[/(?:距|距离|至|到|离)?([^，。；（）()]{0,45}(?:地铁[^，。；（）()]{0,20}|[^，。；（）()]{0,20}站)[^，。；（）()]{0,18}?)\s*(\d+(?:\.\d+)?)\s*(公里|千米|km|米|m)(?=[，。；（）()\s,]|步行|即|正|$)/gi];
 const found=[];
 for(const p of patterns)for(const m of clean.matchAll(p)) {
  if(!/地铁|\d+号线/.test(m[1]))continue;
  const meters=Number(m[2])*((m[3]==='公里'||m[3]==='千米'||m[3]==='km')?1000:1);
  if(meters>0&&meters<20000)found.push({meters,station:m[1].replace(/^(?:距|距离|至|到|离)/,'').trim(),evidence:m[0],kind:'官方描述距离'});
 }
 return found.sort((a,b)=>a.meters-b.meters)[0]||null;
}
export function validateDates(checkIn,checkOut) {
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(!/^\d{4}-\d{2}-\d{2}$/.test(checkIn)||!/^\d{4}-\d{2}-\d{2}$/.test(checkOut))throw new Error('请选择有效的入住和离店日期');
 const a=Date.parse(checkIn+'T00:00:00+08:00'),b=Date.parse(checkOut+'T00:00:00+08:00');
 if(Number.isFinite(a)&&new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(a))!==checkIn)throw new Error('入住日期不存在');
 if(Number.isFinite(b)&&new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(b))!==checkOut)throw new Error('离店日期不存在');
 if(!Number.isFinite(a)||!Number.isFinite(b)||checkIn<today||b<=a||b-a>30*86400000||a-Date.parse(today+'T00:00:00+08:00')>89*86400000)throw new Error('入住日期需在未来90天内，住宿时间为1至30晚');
 return {checkIn,checkOut};
}
export function normalizeHotel(html,checkIn,checkOut,sourcePath='') {
 const d=extractModel(html),i=d.Info,hotelInfo=i.HotelInfo||{};
 if(/虚拟|测试|停业|歇业|酒店停$|质量整改/i.test(i.HotelName||''))throw new Error('官方门店标记为测试、停业或整改，已排除');
 const matchedBrand=matchBrand(i.BrandName,i.HotelName),brand=matchedBrand?.name;
 const city=d.ExpandEntity?.HuaZhuHotelEntity?.CityName||i.ContactInfos?.[0]?.Addresses?.[0]?.CityName;
 if(city!=='上海'||!brand)throw new Error('只接收上海华住品牌酒店');
 const description=hotelInfo.Descriptions?.Description?.Text?.map(x=>x.Value||'').join(' ')||'';
 const address=i.ContactInfos?.[0]?.Addresses?.find(x=>x.UseType==='8')?.AddressLine?.join(' ')||i.ContactInfos?.[0]?.Addresses?.[0]?.AddressLine?.join(' ')||'';
 const sourceUrl=`${ORIGIN}${sourcePath||'/Hotel/Detail/'+encodeURIComponent(i.HotelCode)}?CheckInDate=${checkIn}&CheckOutDate=${checkOut}`;
 const score=safeNumber(d.HotelScore),count=html.match(/([\d,]+)条(?:评价|评论)/)?.[1];
 const actualIn=html.match(/ndoo\.vars\.wa\.checkin_date\s*=\s*"([^"]+)"/)?.[1];
 const actualOut=html.match(/ndoo\.vars\.wa\.checkout_date\s*=\s*"([^"]+)"/)?.[1];
 return {id:String(i.HotelCode),name:i.HotelName,brand,city,address,description,score:count&&Number(count.replace(/,/g,''))>0&&score!==null&&score>=0&&score<=5?score:null,reviewCount:count?Number(count.replace(/,/g,'')):null,metro:extractMetro(address+' '+description),opening:extractOpening(description),image:d.Photos?.find(x=>x.ImageType===1)?.ImageURL||d.Photos?.[0]?.ImageURL||null,sourceUrl,source:'华住会官方公开页面',fetchedAt:new Date().toISOString(),checkIn,checkOut,quote:null,quoteStatus:(actualIn===checkIn&&actualOut===checkOut)?'官方暂未返回可验证的公开报价':'官方未确认查询日期',roomCount:Array.isArray(d.Rooms)?d.Rooms.length:0};
}
export function selectHotels(hotels,filters={}) {
 const {q='',brand='',category='',maxMetro=0,minYear=0,minScore=0,includeUnknown=false,sort='metro',favorites=null,checkIn='',checkOut=''}=filters;
 const matches=(v,active,test)=>!active||(v==null?includeUnknown:test(v));
 const list=hotels.filter(h=>(!q||`${h.name} ${h.address} ${h.metro?.station||''}`.toLowerCase().includes(q.toLowerCase()))&&(!brand||h.brand===brand)&&(!category||category==='全部品类'||getBrand(h.brand)?.category===category)&&(!favorites||favorites.includes(h.id))&&matches(h.metro?.meters,Number(maxMetro)>0,v=>v<=Number(maxMetro))&&matches(h.opening?.year,Number(minYear)>0,v=>v>=Number(minYear))&&matches(h.score,Number(minScore)>0,v=>v>=Number(minScore)));
 const val=h=>sort==='price'?activeQuote(h.quote,checkIn,checkOut)?.amount:sort==='score'?h.score:sort==='opening'?h.opening?.year:h.metro?.meters;
 return list.sort((a,b)=>{const av=val(a),bv=val(b);if(av==null)return bv==null?0:1;if(bv==null)return -1;return sort==='metro'||sort==='price'?av-bv:bv-av;});
}
export async function createSession() {
 const jar=new Map();
 return async(path,options={})=>{
  const u=new URL(path,ORIGIN);if(u.origin!==ORIGIN)throw new Error('只允许访问华住官方渠道');
  const r=await fetch(u,{...options,redirect:'follow',headers:{'User-Agent':'Mozilla/5.0','Referer':ORIGIN+'/city/shanghai','Cookie':[...jar].map(([k,v])=>`${k}=${v}`).join('; '),...options.headers},signal:options.signal||AbortSignal.timeout(18000)});
  const set=r.headers.getSetCookie?.()||[];for(const c of set){const pair=c.split(';')[0],at=pair.indexOf('=');if(at>0)jar.set(pair.slice(0,at),pair.slice(at+1));}
  if(!r.ok)throw new Error(`官方页面暂时无法读取（${r.status}）`);return r.text();
 };
}
export async function discoverHotels(query='上海',brandName='') {
 if(query.length>60)throw new Error('搜索词过长');
 const brand=brandName?getBrand(brandName):null;if(brandName&&!brand)throw new Error('请选择品牌目录中的品牌');
 const get=await createSession(),results=new Map();
 for(const term of brand?brand.searchTerms:[query]){
 const d=JSON.parse(await get('/Hotel/HotelSearch?keywords='+encodeURIComponent(term)));
 for(const h of [...(d.obj?.HZHOTELList||[]),...(d.obj?.YGHOTELList||[])]){const matched=matchBrand('',h.Name);if(!h.Name?.includes('上海')||!matched||(brand&&matched.id!==brand.id)||/虚拟|测试|停业|酒店停$/.test(h.Name))continue;results.set(h.Code,{id:h.Code,name:h.Name});}
 }
 return [...results.values()];
}
export async function fetchHotel(id,checkIn,checkOut) {
 if(!/^[a-zA-Z0-9]{3,14}$/.test(id))throw new Error('无效酒店编号');
 const get=await createSession(),path=/^\d{7,}$/.test(id)?`/Hotel/Detail/${id}`:`/Hotel/InterDetail/${id}`;
 return normalizeHotel(await get(`${path}?CheckInDate=${checkIn}&CheckOutDate=${checkOut}`),checkIn,checkOut,path);
}
