'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,LoaderCircle,Pause,Play,Radio,RotateCcw} from 'lucide-react';
import {runPriceQueue,isPriceFailure,PRICE_PREVIEW_COUNT} from '../lib/price-queue.mjs';
import {activeQuote} from '../lib/price-utils.mjs';
import {validateDates} from '../lib/official.mjs';

type BaseHotel={id:string,name:string,sourceUrl:string,quote?:unknown};
type Result={id:string,name:string,checkIn:string,checkOut:string,sourceUrl:string,checkedAt:string,status:string,message:string,dateConfirmed:boolean,hotel:unknown,roomTypes:{name:string,bed:string|null,area:string|null}[]};
type Props={hotels:BaseHotel[],checkIn:string,checkOut:string,auto:boolean,onAuto:(value:boolean)=>void,onHotels:(hotels:unknown[])=>void};
const stamp=(v:string)=>new Date(v).toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
const labels:Record<string,string>={reference_price:'已取得官网划线参考价',no_available_reference:'参考价对应房型暂不可订',login_required:'官网要求登录',verification_required:'官网要求验证',date_unconfirmed:'日期未确认',rooms_without_quote:'房型已读取 · 参考价待核验',no_public_quote:'尚无可核验参考价',timeout:'官网响应超时',unavailable:'官网暂不可读'};
export default function RealtimePanel({hotels,checkIn,checkOut,auto,onAuto,onHotels}:Props){
 const [results,setResults]=useState<Result[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[plan,setPlan]=useState<BaseHotel[]>([]),[completed,setCompleted]=useState(0),[paused,setPaused]=useState(false);
 const controller=useRef<AbortController|null>(null),lock=useRef(false),attempted=useRef(new Map<string,Result>()),planRef=useRef<BaseHotel[]>([]),autoStarted=useRef(false),hotelsRef=useRef(hotels),onHotelsRef=useRef(onHotels);
 hotelsRef.current=hotels;onHotelsRef.current=onHotels;
 useEffect(()=>()=>{controller.current?.abort()},[]);
 let dateError='';try{validateDates(checkIn,checkOut)}catch(e){dateError=e instanceof Error?e.message:'日期无效'}
 const covered=hotels.filter(h=>activeQuote(h.quote,checkIn,checkOut)).length;
 const failed=results.filter(isPriceFailure),noQuote=results.filter(r=>!isPriceFailure(r)&&r.status!=='reference_price').length;
 const remaining=plan.filter(h=>!attempted.current.has(h.id));
 async function query(targets:BaseHotel[],resume=false){
  if(lock.current||!targets.length||dateError)return;
  autoStarted.current=true;lock.current=true;setBusy(true);setPaused(false);setError('');
  if(!resume){attempted.current=new Map();planRef.current=targets;setPlan(targets);setResults([]);setCompleted(0)}
  const control=new AbortController();controller.current=control;
  try{
   const outcome=await runPriceQueue({hotels:targets,checkIn,checkOut,signal:control.signal,onBatch:(next:Result[])=>{
    if(control.signal.aborted)return;
    for(const result of next){attempted.current.delete(result.id);attempted.current.set(result.id,result)}
    setResults([...attempted.current.values()]);setCompleted(attempted.current.size);
    onHotelsRef.current(next.filter(r=>r.hotel).map(r=>r.hotel));
   }});
   if(controller.current===control)setPaused(outcome.paused||planRef.current.some(h=>!attempted.current.has(h.id)));
  }catch(e){if(!control.signal.aborted){setError(e instanceof Error?e.message:'查询失败，已有价格保留。');setPaused(true)}}
  finally{if(controller.current===control){lock.current=false;setBusy(false)}}
 }
 function pause(){controller.current?.abort();setPaused(true)}
 // Wait for both date inputs to settle. A new date remounts and aborts the old queue.
 useEffect(()=>{
  if(!auto||dateError||!hotels.length||autoStarted.current)return;
  const timer=setTimeout(()=>{if(autoStarted.current)return;const first=hotelsRef.current.slice(0,PRICE_PREVIEW_COUNT);if(first.length)void query(first)},800);
  return()=>clearTimeout(timer);
 },[auto,dateError,hotels.length,checkIn,checkOut]);
 return <section id="price-updates" className="realtime-panel" aria-label="官网价格批量更新">
  <div className="realtime-title"><h3><Radio size={17}/> 官网价格批量更新</h3><span>连续分批 · 逐批显示</span></div>
  <p>查询 {checkIn} 至 {checkOut}。一次启动可更新全部筛选结果，每批 6 家自动接续；无需反复点击。更新期间请保持页面打开。</p>
  <label className="price-auto"><input type="checkbox" checked={auto} onChange={e=>onAuto(e.target.checked)}/> 切换日期后自动更新前 {PRICE_PREVIEW_COUNT} 家（首次进入也更新）</label>
  <div className="realtime-controls">
   <button id="update-all-prices" onClick={()=>void query(hotels)} disabled={busy||!hotels.length||!!dateError}>{busy?<LoaderCircle size={15} className="spin"/>:<RotateCcw size={15}/>} {busy?'正在连续更新…':`更新全部筛选 ${hotels.length} 家`}</button>
   {busy?<button className="secondary" onClick={pause}><Pause size={15}/> 暂停更新</button>:<>
    {paused&&remaining.length>0&&<button className="secondary" onClick={()=>void query(remaining,true)} disabled={!!dateError}><Play size={15}/> 继续剩余 {remaining.length} 家</button>}
    {failed.length>0&&<button className="secondary" onClick={()=>void query(planRef.current.filter(h=>failed.some(r=>r.id===h.id)),true)} disabled={!!dateError}>重试失败 {failed.length} 家</button>}
   </>}
  </div>
  <div className="price-progress" role="status" aria-live="polite">
   <p>当前筛选 {hotels.length} 家 · 所选日期有参考价 {covered} 家</p>
   {plan.length>0&&<><progress aria-label="本轮价格更新进度" max={plan.length} value={completed}/><p>{busy?'更新中':paused?'已暂停':'本轮完成'} · 已查 {completed} / {plan.length} 家 · 取得参考价 {results.filter(r=>r.status==='reference_price').length} 家 · 无可用参考价 {noQuote} 家 · 连接失败 {failed.length} 家</p></>}
  </div>
  {(dateError||error)&&<p className="realtime-error" role="alert">{dateError||error}</p>}
  <p className="realtime-limit">主价为官网划线参考价。黄金8.8折、铂金8.5折为估算。未返回价格不代表满房；失败时保留已有价格及采集时间。更新范围以启动时的筛选结果为准。</p>
  <details className="price-query-log"><summary>最近查询记录{results.length?`（显示最近 ${Math.min(6,results.length)} 家）`:''}</summary>{results.slice(-6).map(r=><article className="live-result" key={r.id}><div><strong>{r.name}</strong><span className={r.status==='reference_price'?'live-connected':'live-blocked'}>{labels[r.status]||'查询已完成'}</span><p>{r.message}</p><small>{stamp(r.checkedAt)} 查询 · {r.dateConfirmed?'官网已确认所选日期':'日期或房态未核验'}</small></div><a href={r.sourceUrl} target="_blank" rel="noreferrer" aria-label={'官网查询'+r.name}>官网 <ArrowUpRight size={13}/></a></article>)}</details>
 </section>;
}
