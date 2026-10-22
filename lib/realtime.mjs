import {createSession,extractModel,normalizeHotel} from './official.mjs';
import {queryOfficialPrices,bookingUrl} from './official-prices.mjs';

export function inspectPublicPage(html,id,checkIn,checkOut,path){
 const title=html.match(/<title[^>]*>([^<]*)/i)?.[1]||'';
 if(/登录|登錄|sign in|log in/i.test(title))return {status:'login_required',message:'官网要求登录，本站未取得该门店的公开房型与报价。',dateConfirmed:false,hotel:null,roomTypes:[]};
 if(/验证码|安全验证|captcha|access denied/i.test(title))return {status:'verification_required',message:'官网要求验证，请进入官方页面继续查询。',dateConfirmed:false,hotel:null,roomTypes:[]};
 const model=extractModel(html);
 if(String(model.Info.HotelCode)!==id)throw new Error('官网返回的酒店编号与查询不符');
 const actualIn=html.match(/checkin_date\s*=\s*"([^"]+)"/)?.[1],actualOut=html.match(/checkout_date\s*=\s*"([^"]+)"/)?.[1];
 const dateConfirmed=actualIn===checkIn&&actualOut===checkOut;
 const hotel=normalizeHotel(html,checkIn,checkOut,path);
 const roomTypes=(Array.isArray(model.Rooms)?model.Rooms:[]).map(r=>r.RoomDetail||{}).filter(r=>r.RoomTypeName).map(r=>({name:String(r.RoomTypeName),bed:r.BedTypeName?String(r.BedTypeName):null,area:r.RoomArea?String(r.RoomArea):null}));
 // The site's /Hotel/Price calendar is explicitly a member-price table. Do not
 // substitute it for the requested public rate or infer stock from empty Rooms.
 const status=!dateConfirmed?'date_unconfirmed':roomTypes.length?'rooms_without_quote':'no_public_quote';
 const message=!dateConfirmed?'已读取官网资料，但官网未确认所选日期，房价与房态未核验。':roomTypes.length?`已读取 ${roomTypes.length} 个房型；尚未取得可核验的官方公开价，库存以官网为准。`:'已读取官网资料并确认查询日期；官网未返回房型与公开报价，不能据此判断满房。';
 return {status,message,dateConfirmed,hotel:{...hotel,quoteStatus:message,detailStatus:'verified'},roomTypes};
}

export async function queryLegacyHotel(hotel,checkIn,checkOut,{getSession=createSession}={}){
 const began=Date.now(),id=hotel.id;
 if(!/^[a-zA-Z0-9]{3,14}$/.test(id))throw new Error('无效酒店编号');
 const path=/^\d{7,}$/.test(id)?`/Hotel/Detail/${id}`:`/Hotel/InterDetail/${id}`;
 const sourceUrl=`https://m.huazhu.com${path}?CheckInDate=${checkIn}&CheckOutDate=${checkOut}`;
 try{
  const session=await getSession(),signal=AbortSignal.timeout(12000),get=(url,options={})=>session(url,{...options,signal});
  await get('/city/shanghai?cityId=3101');
  const set=JSON.parse(await get('/Hotel/NewSetParameter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({cityid:'3101',cityname:'上海',hotelid:id,checkInDate:checkIn,checkOutDate:checkOut})}));
  if(set.isSuccess!==1)throw new Error('官网未接受本次日期查询');
  const result=inspectPublicPage(await get(`${path}?CheckInDate=${checkIn}&CheckOutDate=${checkOut}`),id,checkIn,checkOut,path);
  return {id,name:hotel.name,checkIn,checkOut,sourceUrl,checkedAt:new Date().toISOString(),elapsedMs:Date.now()-began,quote:null,...result};
 }catch(e){
  const timeout=e?.name==='TimeoutError'||e?.name==='AbortError';
  return {id,name:hotel.name,checkIn,checkOut,sourceUrl,checkedAt:new Date().toISOString(),elapsedMs:Date.now()-began,quote:null,status:timeout?'timeout':'unavailable',message:timeout?'官网响应超时，现有资料已保留。':'官网本次未返回可读取的公开详情，现有资料已保留，请进入官网查询。',dateConfirmed:false,hotel:null,roomTypes:[]};
 }
}

export async function queryPublicHotel(hotel,checkIn,checkOut,options={}){
 const began=Date.now();
 try{return await queryOfficialPrices(hotel,checkIn,checkOut,options);}
 catch(e){console.warn('Official price query failed',hotel.id,e?.name,e?.message);const timeout=e?.name==='TimeoutError'||e?.name==='AbortError';return {id:hotel.id,name:hotel.name,checkIn,checkOut,sourceUrl:bookingUrl(hotel.id,checkIn,checkOut),checkedAt:new Date().toISOString(),elapsedMs:Date.now()-began,quote:null,status:timeout?'timeout':'unavailable',message:timeout?'官方房价查询超时，已保留原有资料。':'官方本次未返回可核验的房价，已保留原有资料，请到官网确认。',dateConfirmed:false,hotel:null,roomTypes:[]};}
}

export function validateQueryBody(body,knownIds){
 if(!body||!Array.isArray(body.ids)||body.ids.length<1||body.ids.length>6)throw new Error('每次请选择1至6家已收录酒店');
 const ids=[...new Set(body.ids)];
 if(ids.some(id=>typeof id!=='string'||!knownIds.has(id)))throw new Error('只能查询已收录的上海华住门店');
 return ids;
}
