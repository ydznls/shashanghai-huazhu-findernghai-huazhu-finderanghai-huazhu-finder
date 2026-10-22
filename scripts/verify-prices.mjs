import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {parseReferencePrices,queryOfficialPrices} from '../lib/official-prices.mjs';
import {activeQuote,memberEstimate} from '../lib/price-utils.mjs';
import {selectHotels} from '../lib/official.mjs';
const f=JSON.parse(await fs.readFile('data/price-fixture.json','utf8')),hotel={id:'9007771',name:'汉庭上海虹桥北新泾地铁站酒店'};
const parse=p=>parseReferencePrices(p,f.identity,hotel,'2026-10-22','2026-10-23');
const original=parse(f.payload);assert.equal(original.quote.amount,389);assert.equal(original.quote.total,389);assert.equal(original.quote.roomName,'高级大床房A');assert.notEqual(original.quote.amount,381);assert.notEqual(original.quote.amount,362);
assert.equal(memberEstimate(389,88),342.32);assert.equal(memberEstimate(389,85),330.65);
assert.equal(activeQuote(original.quote,'2026-10-23','2026-10-24'),null);
assert.throws(()=>parseReferencePrices(f.payload,{...f.identity,content:{...f.identity.content,hotelId:'different'}},hotel,'2026-10-22','2026-10-23'));
function mutated(change){const p=structuredClone(f.payload);change(p.content.roomList[0]);return parse(p);}
assert.equal(mutated(r=>r.ratePlanCodeList.forEach(p=>p.dailyPrice[0].date='2026-10-23T00:00:00')).quote,null);
assert.equal(mutated(r=>r.ratePlanCodeList.forEach(p=>p.dailyPrice[0].prices[0].currencyCode='USD')).quote,null);
assert.equal(mutated(r=>r.ratePlanCodeList.forEach(p=>p.dailyPrice[0].prices[0].marketPrice=0)).quote,null);
assert.equal(mutated(r=>r.ratePlanCodeList.forEach(p=>p.fullyBooked=true)).quote,null);
assert.equal(mutated(r=>r.ratePlanCodeList=r.ratePlanCodeList.filter(p=>p.activityId)).quote,null);
const two=structuredClone(f.payload);two.content.roomList[0].ratePlanCodeList.forEach(p=>{const day=structuredClone(p.dailyPrice[0]);day.date='2026-10-23T00:00:00';day.prices[0].marketPrice=411;p.dailyPrice.push(day)});
const nights=parseReferencePrices(two,f.identity,hotel,'2026-10-22','2026-10-24');assert.equal(nights.quote.total,800);assert.equal(nights.quote.amount,400);assert.equal(nights.quote.nights,2);
const rows=[{id:'stale',quote:{...original.quote,checkIn:'2026-10-23'}},{id:'high',quote:{...original.quote,amount:500}},{id:'low',quote:original.quote}];assert.deepEqual(selectHotels(rows,{sort:'price',checkIn:'2026-10-22',checkOut:'2026-10-23'}).map(h=>h.id),['low','high','stale']);
const calls=[];const checked=await queryOfficialPrices(hotel,'2026-10-22','2026-10-23',{readJson:async(path,params)=>{calls.push({path,params});return path.endsWith('/detail')?f.identity:f.payload;}});assert.equal(checked.quote.amount,389);assert.equal(calls.length,2);assert(calls.every(c=>c.params.hotelId===hotel.id&&c.params.checkInDate==='2026-10-22'));
const s=JSON.parse(await fs.readFile('data/official-prices.json','utf8'));let priced=0;
for(const [id,h]of Object.entries(s.hotels)){if(!h.quote)continue;priced++;const q=h.quote;assert(activeQuote(q,s.checkIn,s.checkOut));assert.equal(q.daily.length,q.nights);assert.equal(q.total,Math.round(q.daily.reduce((v,d)=>v+d.amount,0)*100)/100);assert.equal(new URL(q.sourceUrl).hostname,'hweb-hotel.huazhu.com');assert.equal(new URL(q.sourceUrl).searchParams.get('hotelId'),id);assert(q.availability!=='unavailable');}
assert(priced>0);console.log(JSON.stringify({priceChecks:'passed',queried:Object.keys(s.hotels).length,priced,checkIn:s.checkIn,checkOut:s.checkOut}));
