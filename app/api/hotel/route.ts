import snapshot from '../../../data/official-snapshot.json';
import {validateDates} from '../../../lib/official.mjs';
import {queryPublicHotel} from '../../../lib/realtime.mjs';
export async function GET(request:Request){
 try{const p=new URL(request.url).searchParams,{checkIn,checkOut}=validateDates(p.get('checkIn')||'',p.get('checkOut')||''),id=p.get('id')||'';
 if(!/^[a-zA-Z0-9]{3,14}$/.test(id))return Response.json({error:'无效酒店编号'},{status:400});
 const hotel=snapshot.hotels.find(h=>h.id===id)||{id,name:'酒店'},result=await queryPublicHotel(hotel,checkIn,checkOut);
 if(!result.hotel)return Response.json({error:result.message,connectionStatus:result.status},{status:502,headers:{'Cache-Control':'private, no-store'}});
 return Response.json(result.hotel,{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'官方详情暂时无法读取'},{status:400});}
}
