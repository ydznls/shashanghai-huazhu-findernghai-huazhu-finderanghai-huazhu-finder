import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {openingFromBusinessDate} from '../lib/opening.mjs';
import {queryOfficialPrices} from '../lib/official-prices.mjs';
const opening=openingFromBusinessDate('Oct 26, 2024 12:00:00 AM');
assert.equal(opening.year,2024);assert.equal(opening.date,'2024-10-26');
assert.equal(openingFromBusinessDate('2023-03-05T00:00:00+08:00').date,'2023-03-05');
for(const v of [null,undefined,'','Jan 1, 0001 12:00:00 AM','2023-02-30','2024-13-01','2024-00-01','2024-02-00','not a date','2024年装修'])assert.equal(openingFromBusinessDate(v),null);
assert.equal(openingFromBusinessDate('2024-02-29').day,29);
const f=JSON.parse(await fs.readFile('data/price-fixture.json','utf8'));
const identity={...f.identity,content:{...f.identity.content,businessDate:'Oct 26, 2024 12:00:00 AM',description:'品牌成立于2010年，2025年装修'}};
const result=await queryOfficialPrices({id:'9007771',name:'测试酒店',opening:null},'2026-10-22','2026-10-23',{readJson:async p=>p.endsWith('/detail')?identity:f.payload});
assert.equal(result.hotel.opening.year,2024);assert.match(result.hotel.opening.sourceUrl,/hotelId=9007771/);assert.equal(result.hotel.opening.checkedAt,result.checkedAt);
const collected=JSON.parse(await fs.readFile('data/official-opening.json','utf8'));
const snapshot=JSON.parse(await fs.readFile('data/official-snapshot.json','utf8'));
let verified=0;
for(const [id,row] of Object.entries(collected.hotels)){
 assert.equal(row.id,id);const source=new URL(row.sourceUrl);assert.equal(source.hostname,'hweb-hotel.huazhu.com');
 if(row.sourceKind==='list'){assert.equal(source.pathname,'/hotels/hotel/list');assert.equal(source.searchParams.get('pageIndex'),String(row.pageIndex));}
 else assert.equal(source.searchParams.get('hotelId'),id);
 if(row.status==='verified'){
  verified++;const parsed=openingFromBusinessDate(row.raw);
  assert(parsed);assert.equal(parsed.date,row.opening.date);assert.equal(row.opening.field,'businessDate');
  const hotel=snapshot.hotels.find(h=>h.id===id);assert(hotel);assert.equal(hotel.opening.date,parsed.date);
 }
}
assert(verified>2);console.log(JSON.stringify({openingRows:Object.keys(collected.hotels).length,verified}));
console.log('Opening checks passed: structured dates, calendar validity, source evidence, and live lookup with no opening year in description.');
