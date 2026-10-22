import snapshot from '../../../data/official-snapshot.json';
import {validateDates} from '../../../lib/official.mjs';
import {queryPublicHotel,validateQueryBody} from '../../../lib/realtime.mjs';
const known=new Map(snapshot.hotels.map(h=>[h.id,h]));
export async function POST(request:Request){
 let ids:string[],checkIn:string,checkOut:string;
 try{if(Number(request.headers.get('Content-Length'))>4000)throw Error('查询内容过长');const text=await request.text();if(text.length>4000)throw Error('查询内容过长');const body=JSON.parse(text);ids=validateQueryBody(body,new Set(known.keys()));({checkIn,checkOut}=validateDates(body.checkIn||'',body.checkOut||''));}
 catch(e){return Response.json({error:e instanceof Error?e.message:'查询参数无效'},{status:400});}
 const results=new Array(ids.length);let cursor=0;
 async function worker(){for(;;){const index=cursor++;if(index>=ids.length||request.signal.aborted)return;results[index]=await queryPublicHotel(known.get(ids[index])!,checkIn,checkOut,{signal:request.signal});}}
 // The browser queue can span every filtered hotel; this endpoint stays small.
 await Promise.all([worker(),worker()]);
 return Response.json({results,checkIn,checkOut,queriedAt:new Date().toISOString(),mode:'official-reference-on-demand',referencePricesAvailable:results.some(r=>r.quote!==null)},{headers:{'Cache-Control':'private, no-store'}});
}
