import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parseHotelList} from '../lib/official-list.mjs';
const item=(id,name,score,count)=>`<div class="item Lposr" data-url="/Hotel/InterDetail/${id}?checkInDate=2026-10-22&amp;checkOutDate=2026-10-23" data-hotelid="${id}"><h3 class="hotelname">${name}</h3><div class="location">距市中心100米</div><div class="mixInfo Lcfx"><span class="scores"> <i>${score}</i>分</span><span class="comment">${count}条评论</span></div></div>`;
const html=item('9000001','全季上海地铁站酒店',5,0)+item('9000002','上海美仑国际酒店',4.8,123)+item('3333337','你好虚拟上海虚拟酒店',5,0)+`<script>ndoo.vars.wa.result_count='3';ndoo.vars.pagetotal='1';ndoo.vars.searchCityName="上海";</script>`;
const r=parseHotelList(html,{checkIn:'2026-10-22',checkOut:'2026-10-23',page:1});
assert.equal(r.reportedTotal,3);assert.equal(r.rows.length,2);assert.equal(r.excluded.length,1);
assert.equal(r.rows[0].score,null);assert.equal(r.rows[0].metro,null);assert.equal(r.rows[0].opening,null);assert.equal(r.rows[0].quote,null);
assert.equal(r.rows[1].brand,'美仑国际');assert.equal(r.rows[1].score,4.8);assert.equal(r.rows[1].reviewCount,123);
assert.equal(new URL(r.rows[1].sourceUrl).searchParams.get('checkOutDate'),'2026-10-23');
assert.throws(()=>parseHotelList(html.replace('searchCityName="上海"','searchCityName="北京"'),{page:1}));
const path='data/crawl-audit.json';
try{const a=JSON.parse(await fs.readFile(path,'utf8')),s=JSON.parse(await fs.readFile('data/official-snapshot.json','utf8'));
assert.equal(a.readPages,a.totalPages);assert.equal(a.pages.length,a.totalPages);assert.equal(new Set(a.pages.map(p=>p.page)).size,a.totalPages);
assert.equal(a.uniqueHotels,s.hotels.length);assert.equal(new Set(s.hotels.map(h=>h.id)).size,s.hotels.length);
assert(s.hotels.length>51);assert(s.hotels.every(h=>h.listEvidence?.city==='上海'));
console.log(JSON.stringify({listParsing:'passed',crawlPages:a.readPages,hotels:s.hotels.length,details:a.detailsFetched}));
}catch(e){if(e.code==='ENOENT')console.log('List parsing passed; crawl audit not created yet.');else throw e;}
