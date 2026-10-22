import {createSession,decodeText} from './official.mjs';
import {matchBrand} from './brands.mjs';
export function parseHotelList(html,{checkIn,checkOut,page,fetchedAt=new Date().toISOString()}={}){
 const reportedTotal=Number(html.match(/result_count\s*=\s*['"](\d+)/)?.[1])||0;
 const totalPages=Number(html.match(/pagetotal\s*=\s*['"](\d+)/)?.[1])||0;
 const city=html.match(/searchCityName\s*=\s*("(?:\\.|[^"\\])*")/)?.[1];
 if(city&&JSON.parse(city)!=='上海')throw new Error('官方列表目的地不是上海');
 const rows=[],excluded=[];
 for(const m of html.matchAll(/<div\s+class="item Lposr"[^>]*data-url="([^"]+)"[^>]*data-hotelid="([^"]+)"[^>]*>([\s\S]*?)(?=<div\s+class="item Lposr"|<script>|$)/g)){
  const [,url,id,body]=m,name=decodeText(body.match(/<h3\s+class="hotelname">([\s\S]*?)<\/h3>/)?.[1]||'');
  const brand=matchBrand('',name)?.name;
  if(!name||/虚拟|测试|停业|歇业|酒店停$|质量整改/.test(name)){excluded.push({id,name,reason:'官方标记为测试、虚拟、停业或整改'});continue;}
  if(!brand){excluded.push({id,name,reason:'不在已核验华住品牌目录中'});continue;}
  const reviewCount=Number(decodeText(body.match(/class="comment">([\s\S]*?)<\/span>/)?.[1]||'').replace(/[^\d]/g,''))||0;
  const rawScore=Number(body.match(/class="scores">\s*<i>([\d.]+)<\/i>/)?.[1]);
  const image=body.match(/<img\s+src="(https:[^"]+)"/)?.[1]||null;
  const sourceUrl=new URL(decodeText(url),'https://m.huazhu.com').href;
  const listSourceUrl=`https://m.huazhu.com/${page===1?'Hotel/ListAsync?':'Hotel/More?v=2&'}page=${page}`;
  rows.push({id,name,brand,city:'上海',address:'',description:'',score:reviewCount>0&&rawScore>=0&&rawScore<=5?rawScore:null,reviewCount,metro:null,opening:null,image,sourceUrl,source:'华住会官方上海酒店列表',fetchedAt,checkIn,checkOut,quote:null,quoteStatus:'官方列表未返回可验证的公开报价',roomCount:0,detailStatus:'list-only',listEvidence:{sourceUrl:listSourceUrl,city:'上海',page,fetchedAt,scoreText:decodeText(body.match(/class="mixInfo[^>]*>([\s\S]*?)<\/div>/)?.[1]||'')}});
 }
 return {rows,excluded,reportedTotal,totalPages};
}
export async function createShanghaiListSession(checkIn,checkOut){
 const get=await createSession();
 await get('/city/shanghai?cityId=3101&cityName=%E4%B8%8A%E6%B5%B7');
 const set=JSON.parse(await get('/Hotel/NewSetParameter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({cityid:'3101',cityname:'上海',checkInDate:checkIn,checkOutDate:checkOut})}));
 if(set.isSuccess!==1)throw new Error('官网未接受上海查询条件');
 return async page=>{if(!Number.isInteger(page)||page<1||page>500)throw new Error('无效列表页码');const html=await get(page===1?'/Hotel/ListAsync?page=1':`/Hotel/More?v=2&page=${page}`);return {html,...parseHotelList(html,{checkIn,checkOut,page})};};
}
