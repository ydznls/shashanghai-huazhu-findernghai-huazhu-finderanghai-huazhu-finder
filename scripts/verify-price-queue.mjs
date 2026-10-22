import assert from 'node:assert/strict';
import {runPriceQueue,isPriceFailure} from '../lib/price-queue.mjs';
import {queryOfficialPrices} from '../lib/official-prices.mjs';
const hotels=Array.from({length:901},(_,i)=>({id:String(9000001+i),name:'酒店'+i,sourceUrl:'https://hrewards.huazhu.com/'}));
const checkIn='2026-11-10',checkOut='2026-11-11';
const result=(id,status='reference_price')=>({id,checkIn,checkOut,status,hotel:null});
const reply=(ids,status)=>({checkIn,checkOut,results:ids.map(id=>result(id,status))});
const response=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
function config(overrides={}){return {hotels,checkIn,checkOut,signal:new AbortController().signal,onBatch:()=>{},delayMs:0,...overrides}}

const batches=[],received=[];let active=0,maxActive=0;
const complete=await runPriceQueue(config({onBatch:batch=>received.push(...batch),fetcher:async(url,options)=>{
 active++;maxActive=Math.max(maxActive,active);const body=JSON.parse(options.body);batches.push(body.ids);assert.equal(body.checkIn,checkIn);assert.equal(body.checkOut,checkOut);assert(body.ids.length<=6);active--;return response(reply(body.ids));
}}));
assert.equal(complete.completed,901);assert.equal(batches.length,151);assert.equal(new Set(received.map(r=>r.id)).size,901);assert.equal(maxActive,1);

const controller=new AbortController(),partial=[];let requests=0;
const paused=await runPriceQueue(config({signal:controller.signal,onBatch:batch=>{partial.push(...batch);controller.abort()},fetcher:async(url,o)=>{requests++;return response(reply(JSON.parse(o.body).ids))}}));
assert.equal(paused.paused,true);assert.equal(partial.length,6);assert.equal(requests,1);
const resumed=[];
await runPriceQueue(config({hotels:hotels.filter(h=>!partial.some(r=>r.id===h.id)),onBatch:b=>resumed.push(...b),fetcher:async(url,o)=>response(reply(JSON.parse(o.body).ids))}));
assert.equal(partial.length+resumed.length,901);assert.equal(new Set([...partial,...resumed].map(r=>r.id)).size,901);

const obsolete=new AbortController();let late=0;
await runPriceQueue(config({hotels:hotels.slice(0,6),signal:obsolete.signal,onBatch:()=>late++,fetcher:async(url,o)=>{obsolete.abort();return response(reply(JSON.parse(o.body).ids))}}));
assert.equal(late,0,'late response must not merge after date switch');

let attempts=0;const recovered=[];
await runPriceQueue(config({hotels:hotels.slice(0,18),onBatch:b=>recovered.push(...b),fetcher:async(url,o)=>{if(++attempts===1)throw Error('offline');return response(reply(JSON.parse(o.body).ids))}}));
assert.equal(recovered.filter(isPriceFailure).length,6);assert.equal(recovered.filter(r=>r.status==='reference_price').length,12);
let consecutive=0;
await assert.rejects(runPriceQueue(config({fetcher:async()=>{consecutive++;throw Error('offline')}})),/连续三批/);assert.equal(consecutive,3);
let limited=0;
await assert.rejects(runPriceQueue(config({fetcher:async()=>{limited++;return new Response('{"error":"限流"}',{status:429})}})),/限流/);assert.equal(limited,1);
for(const malformed of [
 {checkIn:'2026-11-12',checkOut,results:[]},
 {...reply(hotels.slice(0,6).map(h=>h.id)),results:Array(6).fill(result(hotels[0].id))},
 {...reply(hotels.slice(0,6).map(h=>h.id)),results:hotels.slice(0,6).map(h=>({...result(h.id),hotel:{id:h.id,checkIn:'2026-11-09',checkOut}}))}
])await assert.rejects(runPriceQueue(config({hotels:hotels.slice(0,6),fetcher:async()=>response(malformed)})),/不一致/);

let noPrices=0;
await runPriceQueue(config({hotels:hotels.slice(0,24),onBatch:b=>noPrices+=b.length,fetcher:async(url,o)=>response(reply(JSON.parse(o.body).ids,'no_public_quote'))}));
assert.equal(noPrices,24,'missing quotes must not be counted as connection failure or stop the queue');

const external=new AbortController();let forwarded=0;
const cancelled=queryOfficialPrices(hotels[0],checkIn,checkOut,{signal:external.signal,readJson:async(path,params,{signal})=>{
 forwarded++;return new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(signal.reason),{once:true})});
}});
external.abort();await assert.rejects(cancelled);assert.equal(forwarded,2);
console.log('Price queue checks passed: 901 hotels / 151 bounded batches, pause/resume, cancellation, failure recovery, rate limits, no-price results, identity/date checks and upstream abort.');
